import { createClient } from '@supabase/supabase-js';
import { env } from '../../env.js';

/**
 * Service-role client: full access to every table, bypassing RLS.
 * This is the only client used for reading/writing app data — RLS is enabled
 * with no policies, so the anon/authenticated keys can't touch the tables at all.
 * Never send this key to the frontend.
 */
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Anon-key client: used only for the admin-login auth flow (signInWithPassword,
 * getUser, refreshSession), mirroring how a normal Supabase client authenticates.
 */
export const supabaseAuth = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
