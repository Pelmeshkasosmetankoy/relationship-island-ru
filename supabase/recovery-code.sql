-- ============================================================
--  РЕЗЕРВНЫЙ КОД ВОССТАНОВЛЕНИЯ ОСТРОВА
--  Run this ONCE in the Supabase SQL Editor, after auth-migration.sql.
--
--  Зачем: если ОБА партнёра потеряют доступ к своим аккаунтам, впустить на
--  остров будет некому (приглашение создаёт только тот, кто внутри). Резервный
--  код — аварийный вход: длинный секрет, который пара сохраняет в надёжном месте.
--  По нему с ЛЮБОГО нового залогиненного аккаунта можно вернуться на остров.
--
--  Безопасность: коды лежат в отдельной таблице БЕЗ политик доступа — значит их
--  нельзя ни прочитать, ни записать через обычный API. С ними работают только
--  защищённые функции ниже (SECURITY DEFINER). Код 14 символов из 32-буквенного
--  алфавита (~10^21 вариантов) — перебрать невозможно.
-- ============================================================

create table if not exists world_recovery (
  world_code text primary key references worlds(code) on delete cascade,
  code       text not null,
  updated_at timestamptz not null default now()
);
create unique index if not exists world_recovery_code_idx on world_recovery(code);

alter table world_recovery enable row level security;
-- Намеренно НЕ создаём политик: строки недоступны через API.

-- Генератор кода: 14 символов, без похожих букв (нет O/0/1/I).
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

-- Участник создаёт/обновляет резервный код своего острова и получает его один раз.
-- Новый код заменяет старый.
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

-- Любой залогиненный пользователь может вернуться на остров по резервному коду.
-- Ввод нормализуется (регистр, дефисы/пробелы), чтобы код принимался в любом виде.
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
