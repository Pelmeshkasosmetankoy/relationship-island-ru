-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).

create table if not exists worlds (
  code text primary key,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  world_code text not null references worlds(code) on delete cascade,
  type text not null,
  note text default '',
  photo_url text,
  created_at timestamptz not null default now()
);

create index if not exists events_world_code_idx on events(world_code);

-- Row Level Security
-- MVP security model: knowing the 6-character world code is what grants access,
-- the same trust model as the original prototype's shared code. There is no
-- per-user login. Anyone who has (or guesses) the code can read and add events.
-- This is fine for a couple-only app shared by direct invite, but if you later
-- add real accounts, tighten these policies to check auth.uid() against a
-- members table instead of leaving them wide open.

alter table worlds enable row level security;
alter table events enable row level security;

create policy "anyone can create a world" on worlds
  for insert to anon with check (true);

create policy "anyone can read a world by code" on worlds
  for select to anon using (true);

create policy "anyone can read events" on events
  for select to anon using (true);

create policy "anyone can add events" on events
  for insert to anon with check (true);

-- Enable realtime for instant sync between partners (Database → Replication
-- in the dashboard, or run this):
alter publication supabase_realtime add table events;

-- Storage bucket for event photos.
-- Do this in the dashboard: Storage → New bucket → name it "event-photos" → Public bucket: on.
-- Then add this policy so anonymous uploads are allowed (Storage → event-photos → Policies):
--
-- create policy "anyone can upload event photos"
--   on storage.objects for insert to anon
--   with check (bucket_id = 'event-photos');
--
-- create policy "anyone can read event photos"
--   on storage.objects for select to anon
--   using (bucket_id = 'event-photos');


-- =====================================================================
-- Shop / coins (run this block once too, in the SQL editor). Coins are
-- computed from the number of events; only purchases and the active
-- sky/palette need to be stored and shared between partners.
-- =====================================================================

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  world_code text not null references worlds(code) on delete cascade,
  item_key text not null,
  created_at timestamptz not null default now(),
  unique (world_code, item_key)
);
create index if not exists purchases_world_code_idx on purchases(world_code);

alter table purchases enable row level security;
create policy "anyone can read purchases" on purchases
  for select to anon using (true);
create policy "anyone can add purchases" on purchases
  for insert to anon with check (true);

create table if not exists settings (
  world_code text not null references worlds(code) on delete cascade,
  key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (world_code, key)
);

alter table settings enable row level security;
create policy "anyone can read settings" on settings
  for select to anon using (true);
create policy "anyone can add settings" on settings
  for insert to anon with check (true);
create policy "anyone can update settings" on settings
  for update to anon using (true) with check (true);

-- Realtime so a partner sees purchases / theme changes instantly:
alter publication supabase_realtime add table purchases;
alter publication supabase_realtime add table settings;


-- =====================================================================
-- Edit/delete events + wish list ("Хотим вместе"). Run this block once too.
-- =====================================================================

-- allow editing and deleting events (was insert/select only)
create policy "anyone can edit events" on events
  for update to anon using (true) with check (true);
create policy "anyone can delete events" on events
  for delete to anon using (true);

create table if not exists wishes (
  id uuid primary key default gen_random_uuid(),
  world_code text not null references worlds(code) on delete cascade,
  text text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists wishes_world_code_idx on wishes(world_code);

alter table wishes enable row level security;
create policy "anyone can read wishes" on wishes
  for select to anon using (true);
create policy "anyone can add wishes" on wishes
  for insert to anon with check (true);
create policy "anyone can edit wishes" on wishes
  for update to anon using (true) with check (true);
create policy "anyone can delete wishes" on wishes
  for delete to anon using (true);

alter publication supabase_realtime add table wishes;
