import sharp from 'sharp';

export interface ProcessedImage {
  original: Buffer;
  thumbnail: Buffer;
  contentType: 'image/webp';
}

const ORIGINAL_MAX_DIMENSION = 2400;
const THUMBNAIL_MAX_DIMENSION = 480;

/**
 * Re-encodes the upload to webp, capping dimensions and stripping EXIF,
 * so an ~8MB phone photo lands closer to the 1-2MB target from spec section 7.
 */
export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  const image = sharp(buffer, { failOn: 'none' }).rotate();

  const original = await image
    .clone()
    .resize({ width: ORIGINAL_MAX_DIMENSION, height: ORIGINAL_MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const thumbnail = await image
    .clone()
    .resize({ width: THUMBNAIL_MAX_DIMENSION, height: THUMBNAIL_MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 70 })
    .toBuffer();

  return { original, thumbnail, contentType: 'image/webp' };
}
