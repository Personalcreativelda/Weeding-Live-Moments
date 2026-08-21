import { Router } from 'express';
import { z } from 'zod';
import { supabaseAuth } from '../lib/supabase/client.js';
import { setAuthCookies, clearAuthCookies } from '../lib/security/authCookies.js';
import { requireAdmin } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid credentials payload' });
    return;
  }

  const { email, password } = parsed.data;
  const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });

  if (error || !data.session || !data.user) {
    logger.warn('admin login failed', { email });
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  setAuthCookies(res, data.session);

  logger.info('admin login succeeded', { email });
  res.json({
    id: data.user.id,
    email: data.user.email,
    role: (data.user.app_metadata?.role as string | undefined) ?? 'moderator',
  });
});

authRouter.post('/auth/logout', (_req, res) => {
  clearAuthCookies(res);
  res.json({ ok: true });
});

authRouter.get('/auth/me', requireAdmin, (req, res) => {
  res.json({ id: req.admin!.userId, email: req.admin!.email, role: req.admin!.role });
});
