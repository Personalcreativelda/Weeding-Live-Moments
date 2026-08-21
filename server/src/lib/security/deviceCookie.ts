import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { baseCookieOptions } from './cookieOptions.js';

const DEVICE_COOKIE_NAME = 'wlm_device';

export function ensureDeviceId(req: Request, res: Response): string {
  const existing = req.cookies?.[DEVICE_COOKIE_NAME];
  if (typeof existing === 'string' && existing.length > 0) {
    return existing;
  }
  const deviceId = randomUUID();
  res.cookie(DEVICE_COOKIE_NAME, deviceId, {
    httpOnly: true,
    ...baseCookieOptions,
    maxAge: 1000 * 60 * 60 * 24 * 365,
  });
  return deviceId;
}
