-- Wedding Live Moments — Supabase schema
-- Run this once in the Supabase SQL Editor (or `supabase db push`) before starting the app.
-- Tables are accessed exclusively through the backend using the service role key,
-- so Row Level Security is enabled with no policies: this blocks the anon/authenticated
-- keys from touching the data directly while the service role always bypasses RLS.

create extension if not exists pgcrypto;

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  event_type text not null default 'wedding',
  couple_name_1 text not null,
  couple_name_2 text not null,
  event_date timestamptz,
  hashtag text,
  welcome_message text,
  logo_url text,
  cover_url text,
  primary_color text not null default '#B08968',
  secondary_color text not null default '#F5EDE4',
  theme text not null default 'elegant',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists event_admins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table if not exists tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  number text not null,
  name text,
  qr_token text not null unique,
  created_at timestamptz not null default now(),
  unique (event_id, number)
);

create table if not exists moments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  table_id uuid references tables(id) on delete set null,
  guest_name text,
  message text,
  media_type text not null default 'image',
  storage_key text not null,
  thumbnail_key text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  origin text not null default 'general',
  device_hash text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null
);

create index if not exists moments_event_status_idx on moments (event_id, status);
create index if not exists moments_event_created_idx on moments (event_id, created_at desc);

create table if not exists guest_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  table_id uuid references tables(id) on delete set null,
  guest_name text,
  message text not null,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references moments(id) on delete cascade,
  visitor_hash text not null,
  type text not null default 'like',
  created_at timestamptz not null default now(),
  unique (moment_id, visitor_hash, type)
);

alter table events enable row level security;
alter table event_admins enable row level security;
alter table tables enable row level security;
alter table moments enable row level security;
alter table guest_messages enable row level security;
alter table reactions enable row level security;
