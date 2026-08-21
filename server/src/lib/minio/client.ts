import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../env.js';

const endpoint = env.S3_PORT
  ? `${env.S3_USE_SSL ? 'https' : 'http'}://${env.S3_ENDPOINT}:${env.S3_PORT}`
  : `${env.S3_USE_SSL ? 'https' : 'http'}://${env.S3_ENDPOINT}`;

export const s3 = new S3Client({
  endpoint,
  region: env.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
});

const BUCKET = env.S3_BUCKET;

export async function uploadObject(key: string, body: Buffer, contentType: string) {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

export async function getObjectStream(key: string): Promise<Readable> {
  const result = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  return result.Body as Readable;
}

export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

const SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 6; // 6 hours

export async function getSignedObjectUrl(key: string, expiresInSeconds = SIGNED_URL_EXPIRY_SECONDS) {
  if (env.S3_PUBLIC_URL) {
    return `${env.S3_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  }
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}
