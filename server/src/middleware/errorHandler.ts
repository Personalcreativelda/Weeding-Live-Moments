import type { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { logger } from '../lib/logger.js';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
    res.status(400).json({ error: message });
    return;
  }
  logger.error('unhandled error', { message: err instanceof Error ? err.message : String(err) });
  res.status(500).json({ error: 'Internal server error' });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' });
}
