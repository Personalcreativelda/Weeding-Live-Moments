import type { Response } from 'express';
import type { Session } from '@supabase/supabase-js';
import { baseCookieOptions as crossOriginCookieOptions } from './cookieOptions.js';

export const ACCESS_COOKIE_NAME = 'wlm_admin_access';
export const REFRESH_COOKIE_NAME = 'wlm_admin_refresh';

const baseCookieOptions = {
  httpOnly: true,
  ...crossOriginCookieOptions,
};

export function setAuthCookies(res: Response, session: Session) {
  res.cookie(ACCESS_COOKIE_NAME, session.access_token, {
    ...baseCookieOptions,
    maxAge: (session.expires_in ?? 3600) * 1000,
  });
  res.cookie(REFRESH_COOKIE_NAME, session.refresh_token, {
    ...baseCookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE_NAME, crossOriginCookieOptions);
  res.clearCookie(REFRESH_COOKIE_NAME, crossOriginCookieOptions);
}
