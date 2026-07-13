-- ============================================================
--  УДАЛЕНИЕ СОБСТВЕННОГО АККАУНТА
--  Run this ONCE in the Supabase SQL Editor, after auth-migration.sql.
--
--  Google Play требует, чтобы пользователь мог удалить аккаунт прямо в приложении.
--  Функция удаляет ТОЛЬКО аккаунт вызывающего (auth.uid()). Удаление записи из
--  auth.users каскадно убирает его членство в островах (world_members и
--  world_invites объявлены ON DELETE CASCADE), поэтому человек выходит из всех
--  своих островов. Сами острова и воспоминания остаются — ими продолжает
--  пользоваться партнёр (данные привязаны к острову, а не к аккаунту).
-- ============================================================

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
  -- удаляем сам аккаунт; членство/приглашения этого пользователя уходят по каскаду
  delete from auth.users where id = uid;
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
