import { env } from '../../env.js';

/**
 * Frontend (Vercel) and backend (VPS) live on different origins in production,
 * so cookies must be SameSite=None (which requires Secure/HTTPS) to be sent on
 * cross-site fetch/XHR/<img> requests. Locally everything is same-site, so the
 * more permissive Lax is fine over plain HTTP.
 */
export const baseCookieOptions = env.NODE_ENV === 'production' ? ({ secure: true, sameSite: 'none' } as const) : ({ secure: false, sameSite: 'lax' } as const);
