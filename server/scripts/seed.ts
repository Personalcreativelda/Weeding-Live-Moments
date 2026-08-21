import { env } from '../src/env.js';
import { supabaseAdmin } from '../src/lib/supabase/client.js';

async function getOrCreateAdminUser(email: string, password: string): Promise<string> {
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'super_admin' },
  });

  if (!createError && created.user) return created.user.id;

  // Already exists — look it up instead of failing the whole seed.
  let page = 1;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const existing = data.users.find((u) => u.email === email);
    if (existing) return existing.id;
    if (data.users.length < 200) break;
    page += 1;
  }

  throw new Error(`Could not create or find admin user ${email}: ${createError?.message}`);
}

async function main() {
  const adminEmail = env.ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = env.ADMIN_PASSWORD ?? 'changeme123';

  const userId = await getOrCreateAdminUser(adminEmail, adminPassword);

  const { data: event, error: eventError } = await supabaseAdmin
    .from('events')
    .upsert(
      {
        name: 'Casamento Ekson & Palmira',
        slug: 'casamento-ekson',
        couple_name_1: 'Ekson',
        couple_name_2: 'Palmira',
        hashtag: '#NossoGrandeDia',
        welcome_message: 'Ajude-nos a guardar este momento.',
      },
      { onConflict: 'slug' }
    )
    .select()
    .single();
  if (eventError) throw eventError;

  await supabaseAdmin.from('event_admins').upsert({ event_id: event.id, user_id: userId }, { onConflict: 'event_id,user_id' });

  for (const number of ['01', '02', '03']) {
    await supabaseAdmin
      .from('tables')
      .upsert(
        { event_id: event.id, number, qr_token: `${event.id}-${number}-seed` },
        { onConflict: 'event_id,number' }
      );
  }

  console.log('Seed complete.');
  console.log(`Admin login: ${adminEmail} / ${adminPassword}`);
  console.log(`Event slug: ${event.slug}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
