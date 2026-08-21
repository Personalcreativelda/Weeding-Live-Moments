import crypto from 'node:crypto';
import { env } from '../../env.js';

/**
 * Hashes IP (+ optional device id cookie) so we never persist raw IPs,
 * per spec section 8: SHA256(IP + SECRET).
 */
export function hashDevice(ip: string, deviceId?: string): string {
  const input = `${ip}:${deviceId ?? ''}:${env.DEVICE_HASH_SECRET}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function getClientIp(req: { headers: Record<string, unknown>; socket: { remoteAddress?: string } }): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]!.trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}
