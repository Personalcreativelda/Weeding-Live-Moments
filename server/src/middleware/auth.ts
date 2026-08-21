import type { Request, Response, NextFunction } from 'express';
import { supabaseAuth } from '../lib/supabase/client.js';
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME, setAuthCookies, clearAuthCookies } from '../lib/security/authCookies.js';

export interface AdminSession {
  userId: string;
  email: string;
  role: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminSession;
    }
  }
}

function toAdminSession(user: { id: string; email?: string; app_metadata?: Record<string, unknown> }): AdminSession {
  return {
    userId: user.id,
    email: user.email ?? '',
    role: (user.app_metadata?.role as string | undefined) ?? 'moderator',
  };
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const accessToken = req.cookies?.[ACCESS_COOKIE_NAME];
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  if (!accessToken) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const { data, error } = await supabaseAuth.auth.getUser(accessToken);

  if (!error && data.user) {
    req.admin = toAdminSession(data.user);
    next();
    return;
  }

  if (refreshToken) {
    const { data: refreshed, error: refreshError } = await supabaseAuth.auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (!refreshError && refreshed.session && refreshed.user) {
      setAuthCookies(res, refreshed.session);
      req.admin = toAdminSession(refreshed.user);
      next();
      return;
    }
  }

  clearAuthCookies(res);
  res.status(401).json({ error: 'Session expired, please log in again' });
}
