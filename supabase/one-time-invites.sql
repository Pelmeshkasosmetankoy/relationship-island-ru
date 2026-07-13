-- One-time invite codes for Relationship Island.
-- Run this once in Supabase SQL Editor after auth-migration.sql.
--
-- Result:
-- - the permanent world code stays internal;
-- - an existing island member creates a short invite code;
-- - another logged-in user can use it once within 24 hours;
-- - after joining, that account remains a member and does not need invites again;
-- - each island is limited to two members.

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
