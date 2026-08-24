import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { HttpError } from '../../middleware/errorHandler.js';
import { logger } from '../../lib/logger.js';

const execFileAsync = promisify(execFile);

export const MAX_VIDEO_DURATION_SECONDS = 60;

export interface ProcessedVideo {
  video: Buffer;
  thumbnail: Buffer;
  extension: string;
  contentType: string;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

/**
 * Validates duration (guests record on their phones — a runaway multi-minute
 * video would blow past storage/bandwidth budgets) and extracts a poster frame
 * for thumbnails, using ffmpeg/ffprobe directly rather than pulling in a
 * wrapper library for two commands.
 */
export async function processVideo(buffer: Buffer, mime: string): Promise<ProcessedVideo> {
  const extension = EXTENSION_BY_MIME[mime] ?? 'mp4';
  const dir = await mkdtemp(path.join(tmpdir(), 'wlm-video-'));
  const inputPath = path.join(dir, `input.${extension}`);
  const thumbPath = path.join(dir, 'thumb.webp');

  try {
    await writeFile(inputPath, buffer);

    const duration = await getDurationSeconds(inputPath);
    if (duration === null) {
      throw new HttpError(400, 'Could not read video metadata');
    }
    if (duration > MAX_VIDEO_DURATION_SECONDS) {
      throw new HttpError(400, `Video must be ${MAX_VIDEO_DURATION_SECONDS} seconds or shorter`);
    }

    try {
      await execFileAsync('ffmpeg', [
        '-y',
        '-i', inputPath,
        '-ss', '00:00:00.3',
        '-frames:v', '1',
        '-vf', 'scale=480:-1',
        thumbPath,
      ]);
    } catch (err) {
      logger.error('video thumbnail extraction failed', { message: err instanceof Error ? err.message : String(err) });
      throw new HttpError(500, 'Could not process video');
    }

    const thumbnail = await readFile(thumbPath);

    return {
      video: buffer,
      thumbnail,
      extension,
      contentType: mime,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function getDurationSeconds(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    const value = Number.parseFloat(stdout.trim());
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}
