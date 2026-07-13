-- =====================================================================
--  «НАШ ОСТРОВ» — ПОЛНАЯ НАСТРОЙКА БАЗЫ ДЛЯ СВОЕГО (self-hosted) SUPABASE
--  на российском сервере (Timeweb Cloud).
--
--  Выполнить ОДИН РАЗ, целиком, в SQL-редакторе Supabase Studio нового сервера:
--    Supabase Studio → слева «SQL Editor» → «New query» → вставить весь этот файл
--    → нажать «Run».
--
--  Этот файл объединяет по порядку четыре исходных скрипта проекта:
--    1) schema.sql          — таблицы и открытые политики (черновой режим)
--    2) auth-migration.sql  — аккаунты, членство в островах, ужесточение политик
--    3) recovery-code.sql   — резервный код восстановления острова
--    4) delete-account.sql  — удаление своего аккаунта (требование магазинов)
--  Порядок важен: раздел 2 намеренно заменяет открытые политики раздела 1 на
--  «только участник острова».
--
--  ПОСЛЕ выполнения этого скрипта нужно ещё пара шагов в панели (см.
--  docs/RUSSIAN-HOSTING-SETUP.md): выключить подтверждение email и создать
--  публичный бакет «event-photos». Раздел про фото-политики — в самом низу.
-- =====================================================================


-- =====================================================================
-- РАЗДЕЛ 1. Базовые таблицы (из schema.sql)
-- =====================================================================

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

alter table worlds enable row level security;
alter table events enable row level security;

-- Открытые политики черновика. Ниже (в разделе 2) они удаляются и заменяются
-- на «только участник острова». Создаём их и сразу же ужесточаем, чтобы этот
-- файл давал ровно то же итоговое состояние, что и последовательный прогон
-- исходных скриптов проекта.
create policy "anyone can create a world" on worlds
  for insert to anon with check (true);
create policy "anyone can read a world by code" on worlds
  for select to anon using (true);
create policy "anyone can read events" on events
  for select to anon using (true);
create policy "anyone can add events" on events
  for insert to anon with check (true);

-- Живая синхронизация воспоминаний между партнёрами.
alter publication supabase_realtime add table events;

-- ----- Магазин / монеты -----
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

alter publication supabase_realtime add table purchases;
alter publication supabase_realtime add table settings;

-- ----- Редактирование/удаление воспоминаний + список желаний -----
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


-- =====================================================================
-- РАЗДЕЛ 2. Аккаунты, членство в островах, ужесточение доступа
-- (из auth-migration.sql). После этого раздела код острова — это ПРИГЛАШЕНИЕ:
-- знание кода позволяет залогиненному пользователю один раз вступить; дальше
-- доступ даёт членство.
-- =====================================================================

-- Кто в каком острове (пара).
create table if not exists world_members (
  world_code text not null references worlds(code) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (world_code, user_id)
);
create index if not exists world_members_user_idx on world_members(user_id);

alter table world_members enable row level security;

-- Проверка членства. SECURITY DEFINER, чтобы читать world_members в обход её же
-- политик (иначе была бы рекурсия).
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

drop policy if exists "read own memberships" on world_members;
create policy "read own memberships" on world_members
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "join a world" on world_members;
create policy "join a world" on world_members
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "leave a world" on world_members;
create policy "leave a world" on world_members
  for delete to authenticated using (user_id = auth.uid());

-- worlds: залогиненные создают остров и ищут код для вступления.
drop policy if exists "anyone can create a world" on worlds;
drop policy if exists "anyone can read a world by code" on worlds;
create policy "create a world" on worlds
  for insert to authenticated with check (true);
create policy "look up a world by code" on worlds
  for select to authenticated using (true);

-- events / purchases / settings / wishes: только участники.
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

-- Одноразовые коды-приглашения. Постоянный код острова остаётся внутренним;
-- участник создаёт короткий код, другой залогиненный пользователь использует его
-- один раз в течение 24 часов.
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


-- =====================================================================
-- РАЗДЕЛ 3. Резервный код восстановления острова (из recovery-code.sql)
-- Если ОБА партнёра потеряют аккаунты, вернуться на остров поможет длинный
-- секретный код. Коды лежат в таблице БЕЗ политик — доступ только через
-- защищённые функции ниже.
-- =====================================================================

create table if not exists world_recovery (
  world_code text primary key references worlds(code) on delete cascade,
  code       text not null,
  updated_at timestamptz not null default now()
);
create unique index if not exists world_recovery_code_idx on world_recovery(code);

alter table world_recovery enable row level security;
-- Намеренно НЕ создаём политик: строки недоступны через обычный API.

create or replace function public.make_recovery_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  s text := '';
  i integer;
begin
  for i in 1..14 loop
    s := s || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return s;
end; $$;

create or replace function public.set_recovery_code(wc text)
returns text language plpgsql security definer set search_path = public as $$
declare
  rc text; tries integer := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_world_member(wc) then raise exception 'not a member'; end if;
  loop
    rc := public.make_recovery_code();
    begin
      insert into world_recovery(world_code, code) values (wc, rc)
      on conflict (world_code) do update set code = excluded.code, updated_at = now();
      return rc;
    exception when unique_violation then
      tries := tries + 1;
      if tries >= 8 then raise exception 'could not create recovery code'; end if;
    end;
  end loop;
end; $$;

create or replace function public.redeem_recovery_code(rc text)
returns text language plpgsql security definer set search_path = public as $$
declare
  wc text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select world_code into wc from world_recovery
    where code = regexp_replace(upper(trim(rc)), '[^A-Z0-9]', '', 'g');
  if wc is null then raise exception 'recovery code not found'; end if;
  insert into world_members(world_code, user_id) values (wc, auth.uid())
    on conflict (world_code, user_id) do nothing;
  return wc;
end; $$;

grant execute on function public.set_recovery_code(text) to authenticated;
grant execute on function public.redeem_recovery_code(text) to authenticated;


-- =====================================================================
-- РАЗДЕЛ 4. Удаление своего аккаунта (из delete-account.sql)
-- Магазины (Google Play / RuStore) требуют возможность удалить аккаунт в
-- приложении. Удаляется ТОЛЬКО аккаунт вызывающего; острова и воспоминания
-- остаются партнёру (они привязаны к острову, а не к аккаунту).
-- =====================================================================

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;

grant execute on function public.delete_my_account() to authenticated;


-- =====================================================================
-- РАЗДЕЛ 5. Фото воспоминаний (хранилище)
-- Сначала создай бакет в панели: Storage → New bucket → имя «event-photos»
-- → включи «Public bucket». Затем выполни политику ниже (можно прямо тут).
-- Фото лежат в папке с именем кода острова, напр. «ABC123/pic.jpg»; загружать
-- может только залогиненный участник этого острова. Чтение — публичное по
-- случайной ссылке.
-- =====================================================================

drop policy if exists "anyone can upload event photos" on storage.objects;
drop policy if exists "members upload event photos" on storage.objects;
create policy "members upload event photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event-photos'
    and public.is_world_member((storage.foldername(name))[1])
  );

-- Готово. Дальше — шаги в панели из docs/RUSSIAN-HOSTING-SETUP.md.
