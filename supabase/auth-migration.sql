-- ============================================================
--  ACCOUNTS / LOGIN BY EMAIL (magic link)
--  Run this ONCE in the Supabase SQL Editor (Project → SQL Editor → New query),
--  AFTER you have already run schema.sql for this project.
--
--  What it changes: until now, knowing the 6-character world code was the ONLY
--  thing needed to read or write an island. After this migration you must be
--  (1) logged in AND (2) a member of the world. The code becomes an *invite*:
--  knowing it lets a logged-in user join a world once; membership is what grants
--  ongoing access.
-- ============================================================

-- 1. Who belongs to which world (the couple). ---------------------------------
create table if not exists world_members (
  world_code text not null references worlds(code) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (world_code, user_id)
);
create index if not exists world_members_user_idx on world_members(user_id);

alter table world_members enable row level security;

-- Membership check used by every data policy below. SECURITY DEFINER lets it read
-- world_members without tripping that table's own row-level security (which would
-- otherwise recurse).
create or replace function public.is_world_member(wc text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from world_members m
    where m.world_code = wc and m.user_id = auth.uid()
  );
$$;

-- world_members policies: a user only ever sees / adds / removes their OWN row.
-- Inserting your own row for a code you know = "joining by invite".
drop policy if exists "read own memberships" on world_members;
create policy "read own memberships" on world_members
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "join a world" on world_members;
create policy "join a world" on world_members
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "leave a world" on world_members;
create policy "leave a world" on world_members
  for delete to authenticated using (user_id = auth.uid());

-- 2. worlds: logged-in users may create a world and look up a code to join. -----
drop policy if exists "anyone can create a world" on worlds;
drop policy if exists "anyone can read a world by code" on worlds;
create policy "create a world" on worlds
  for insert to authenticated with check (true);
create policy "look up a world by code" on worlds
  for select to authenticated using (true);

-- 3. events / purchases / settings / wishes: members only. ----------------------
--    (Replaces the old wide-open "anyone can ..." policies.)

drop policy if exists "anyone can read events"   on events;
drop policy if exists "anyone can add events"    on events;
drop policy if exists "anyone can edit events"   on events;
drop policy if exists "anyone can delete events" on events;
create policy "members read events" on events
  for select to authenticated using (public.is_world_member(world_code));
create policy "members add events" on events
  for insert to authenticated with check (public.is_world_member(world_code));
create policy "members edit events" on events
  for update to authenticated using (public.is_world_member(world_code)) with check (public.is_world_member(world_code));
create policy "members delete events" on events
  for delete to authenticated using (public.is_world_member(world_code));

drop policy if exists "anyone can read purchases" on purchases;
drop policy if exists "anyone can add purchases"  on purchases;
create policy "members read purchases" on purchases
  for select to authenticated using (public.is_world_member(world_code));
create policy "members add purchases" on purchases
  for insert to authenticated with check (public.is_world_member(world_code));

drop policy if exists "anyone can read settings"   on settings;
drop policy if exists "anyone can add settings"    on settings;
drop policy if exists "anyone can update settings" on settings;
create policy "members read settings" on settings
  for select to authenticated using (public.is_world_member(world_code));
create policy "members add settings" on settings
  for insert to authenticated with check (public.is_world_member(world_code));
create policy "members update settings" on settings
  for update to authenticated using (public.is_world_member(world_code)) with check (public.is_world_member(world_code));

drop policy if exists "anyone can read wishes"   on wishes;
drop policy if exists "anyone can add wishes"    on wishes;
drop policy if exists "anyone can edit wishes"   on wishes;
drop policy if exists "anyone can delete wishes" on wishes;
create policy "members read wishes" on wishes
  for select to authenticated using (public.is_world_member(world_code));
create policy "members add wishes" on wishes
  for insert to authenticated with check (public.is_world_member(world_code));
create policy "members edit wishes" on wishes
  for update to authenticated using (public.is_world_member(world_code)) with check (public.is_world_member(world_code));
create policy "members delete wishes" on wishes
  for delete to authenticated using (public.is_world_member(world_code));

-- 4. Photos: only a logged-in member of the world may upload. -------------------
--    Photos live under a folder named after the world code, e.g. "ABC123/pic.jpg".
--    Reads stay public via the unguessable random URL for now. If you want photos
--    fully private later, switch the "event-photos" bucket to private and load
--    them with signed URLs instead of public ones.
drop policy if exists "anyone can upload event photos" on storage.objects;
create policy "members upload event photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event-photos'
    and public.is_world_member((storage.foldername(name))[1])
  );

-- 5. One-time invite codes. ----------------------------------------------------
--    The permanent world code stays internal. A member creates a short invite
--    code; another logged-in user can use it once, within 24 hours, to join.
--    After that, the invite is marked as used and cannot be reused.

create table if not exists world_invites (
  code       text primary key,
  world_code text not null references worlds(code) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  used_by    uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  used_at    timestamptz
);
create index if not exists world_invites_world_idx on world_invites(world_code);
create index if not exists world_invites_open_idx on world_invites(code) where used_at is null;

alter table world_invites enable row level security;

create or replace function public.make_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out_code text := '';
  i integer;
begin
  for i in 1..8 loop
    out_code := out_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return out_code;
end;
$$;

create or replace function public.create_world_invite(wc text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_code text;
  tries integer := 0;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_world_member(wc) then
    raise exception 'not a member';
  end if;

  -- No member cap: an island may have any number of accounts, so a partner who
  -- loses their password can rejoin with a new account via a fresh invite.

  loop
    invite_code := public.make_invite_code();
    begin
      insert into world_invites(code, world_code, created_by)
      values (invite_code, wc, auth.uid());
      return invite_code;
    exception when unique_violation then
      tries := tries + 1;
      if tries >= 8 then
        raise exception 'could not create invite code';
      end if;
    end;
  end loop;
end;
$$;

create or replace function public.accept_world_invite(invite_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  already_member boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select *
  into inv
  from world_invites
  where code = upper(trim(invite_code))
  for update;

  if not found then
    raise exception 'invite not found';
  end if;
  if inv.used_at is not null then
    raise exception 'invite already used';
  end if;
  if inv.expires_at < now() then
    raise exception 'invite expired';
  end if;

  select exists (
    select 1 from world_members
    where world_code = inv.world_code and user_id = auth.uid()
  ) into already_member;

  -- No member cap: any number of accounts may belong to one island.
  if not already_member then
    insert into world_members(world_code, user_id)
    values (inv.world_code, auth.uid());
  end if;

  update world_invites
  set used_by = auth.uid(), used_at = now()
  where code = inv.code;

  return inv.world_code;
end;
$$;

grant execute on function public.create_world_invite(text) to authenticated;
grant execute on function public.accept_world_invite(text) to authenticated;
