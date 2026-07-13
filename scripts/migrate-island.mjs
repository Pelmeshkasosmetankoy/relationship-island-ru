// =====================================================================
//  Перенос ОДНОГО острова со старого Supabase (Supabase.com) на новый
//  (свой сервер на Timeweb Cloud) через обычный API. Аккаунты не переносятся —
//  остров привязан к КОДУ, поэтому на новом сервере доступ даёт тот же код.
//
//  Что переносится: сам остров, все воспоминания (с фото), покупки в магазине,
//  настройки (тема/небо) и список желаний.
//
//  КАК ЗАПУСТИТЬ (Windows PowerShell), из папки relationship-island-ru:
//    1) Скопируй scripts/migrate.env.example → scripts/migrate.env и заполни.
//    2) node scripts/migrate-island.mjs
//
//  Скрипт безопасно прерывается, если на новом сервере в этом острове уже есть
//  воспоминания (чтобы не создать дубли). Перезапустить принудительно:
//    в migrate.env поставить FORCE=1  (существующие записи не удаляются,
//    просто снимается защита от повторного добавления).
// =====================================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const INTERNAL_DOMAIN = 'ostrov.local'; // как в src/lib/auth.js

// ---- крошечный загрузчик scripts/migrate.env (KEY=VALUE, # — комментарии) ----
function loadEnvFile() {
  const path = join(HERE, 'migrate.env');
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvFile();

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`✖ Не задана переменная ${name} (в scripts/migrate.env).`);
    process.exit(1);
  }
  return v;
}

const OLD_URL = need('OLD_URL');
const OLD_ANON_KEY = need('OLD_ANON_KEY');
const OLD_LOGIN = need('OLD_LOGIN');
const OLD_PASSWORD = need('OLD_PASSWORD');
let WORLD_CODE = (process.env.WORLD_CODE || '').trim().toUpperCase();
const NEW_URL = need('NEW_URL');
const NEW_ANON_KEY = need('NEW_ANON_KEY');
const NEW_LOGIN = need('NEW_LOGIN');
const NEW_PASSWORD = need('NEW_PASSWORD');
const FORCE = process.env.FORCE === '1';

const loginToEmail = (login) => `${login.trim().toLowerCase()}@${INTERNAL_DOMAIN}`;

function client(url, key) {
  // persistSession=false — в скрипте не нужно хранить сессию на диске
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signIn(sb, login, password, label) {
  const { data, error } = await sb.auth.signInWithPassword({ email: loginToEmail(login), password });
  if (error) throw new Error(`Вход на ${label} не удался для «${login}»: ${error.message}`);
  const uid = data.user?.id;
  if (!uid) throw new Error(`Вход на ${label}: не получили идентификатор пользователя.`);
  return uid;
}

// Для НОВОГО сервера: если аккаунта ещё нет — создаём его (autoconfirm включён,
// поэтому сессия выдаётся сразу). Логин/пароль из migrate.env становятся аккаунтом.
async function signInOrSignUp(sb, login, password, label) {
  const email = loginToEmail(login);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (!error && data.user) return data.user.id;
  const up = await sb.auth.signUp({ email, password });
  if (up.error) {
    throw new Error(`Вход/регистрация на ${label} не удались для «${login}»: ${up.error.message}` +
      ' (если аккаунт уже есть — проверь пароль в migrate.env)');
  }
  if (!up.data.session) throw new Error(`На ${label} аккаунт создан, но сессии нет (autoconfirm выключен?).`);
  console.log(`✔ На ${label} создан новый аккаунт «${login}».`);
  return up.data.user.id;
}

function extFromUrl(url) {
  const clean = url.split('?')[0];
  const m = clean.match(/\.([a-zA-Z0-9]{1,5})$/);
  return (m ? m[1] : 'jpg').toLowerCase();
}

async function main() {
  // ---------- СТАРЫЙ сервер: читаем всё ----------
  const oldSb = client(OLD_URL, OLD_ANON_KEY);
  await signIn(oldSb, OLD_LOGIN, OLD_PASSWORD, 'старый сервер');
  console.log('✔ Вошли на старый сервер.');

  // Если код острова не задан — определяем сами по членству аккаунта.
  if (!WORLD_CODE) {
    const { data, error } = await oldSb.from('world_members').select('world_code');
    if (error) throw new Error('Поиск островов: ' + error.message);
    const codes = [...new Set((data || []).map((r) => r.world_code))];
    if (codes.length === 0) throw new Error('На старом сервере у этого аккаунта нет островов.');
    if (codes.length > 1) {
      throw new Error('Найдено несколько островов: ' + codes.join(', ') +
        '. Впиши нужный в WORLD_CODE в scripts/migrate.env и запусти снова.');
    }
    WORLD_CODE = codes[0];
    console.log('✔ Остров определён автоматически: ' + WORLD_CODE);
  }

  console.log(`\n== Перенос острова ${WORLD_CODE} ==\n`);

  const { data: world, error: wErr } = await oldSb
    .from('worlds').select('code').eq('code', WORLD_CODE).maybeSingle();
  if (wErr) throw wErr;
  if (!world) throw new Error(`Остров ${WORLD_CODE} не найден на старом сервере (или у аккаунта нет к нему доступа).`);

  const grab = async (table, sel = '*') => {
    const { data, error } = await oldSb.from(table).select(sel).eq('world_code', WORLD_CODE);
    if (error) throw new Error(`Чтение ${table}: ${error.message}`);
    return data ?? [];
  };
  const events = (await grab('events')).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const purchases = await grab('purchases', 'item_key');
  const settings = await grab('settings', 'key,value');
  const wishes = await grab('wishes');
  console.log(`✔ Прочитано: воспоминаний ${events.length}, покупок ${purchases.length}, настроек ${settings.length}, желаний ${wishes.length}.`);

  // ---------- НОВЫЙ сервер: пишем всё ----------
  const newSb = client(NEW_URL, NEW_ANON_KEY);
  const newUid = await signInOrSignUp(newSb, NEW_LOGIN, NEW_PASSWORD, 'новый сервер');
  console.log('✔ Вошли на новый сервер.');

  // остров (тот же код) — игнорируем «уже существует» (23505)
  {
    const { error } = await newSb.from('worlds').insert({ code: WORLD_CODE });
    if (error && error.code !== '23505') throw new Error(`Создание острова на новом сервере: ${error.message}`);
  }
  // членство текущего аккаунта — иначе правила доступа не дадут писать воспоминания
  {
    const { error } = await newSb.from('world_members')
      .upsert({ world_code: WORLD_CODE, user_id: newUid }, { onConflict: 'world_code,user_id', ignoreDuplicates: true });
    if (error) throw new Error(`Добавление участника на новом сервере: ${error.message}`);
  }
  console.log('✔ Остров и членство готовы на новом сервере.');

  // Сброс назначения: удаляем прежние воспоминания и желания этого острова на
  // НОВОМ сервере, чтобы перенос был повторяемым (без дублей при перезапуске).
  // Острова/покупки/настройки не трогаем — они добавляются idempotent-но (upsert).
  {
    const d1 = await newSb.from('events').delete().eq('world_code', WORLD_CODE);
    if (d1.error) throw new Error(`Очистка воспоминаний на новом сервере: ${d1.error.message}`);
    const d2 = await newSb.from('wishes').delete().eq('world_code', WORLD_CODE);
    if (d2.error) throw new Error(`Очистка желаний на новом сервере: ${d2.error.message}`);
  }

  // фото: скачиваем со старого сервера через curl (встроенный fetch в этой среде
  // рвёт соединение к хранилищу), затем заливаем в новый бакет event-photos.
  const CTYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
  async function movePhoto(oldUrl) {
    const ext = extFromUrl(oldUrl);
    const tmp = join(tmpdir(), `mig-${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`);
    let lastErr;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        // -f: ошибка при HTTP>=400; -sS: тихо, но показать ошибку; --max-time: таймаут
        execFileSync('curl', ['-fsS', '--max-time', '60', '-o', tmp, oldUrl], { stdio: ['ignore', 'ignore', 'pipe'] });
        const buf = readFileSync(tmp);
        if (!buf.length) throw new Error('пустой файл');
        const contentType = CTYPES[ext] || 'image/jpeg';
        const path = `${WORLD_CODE}/${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`;
        const { error } = await newSb.storage.from('event-photos').upload(path, buf, { contentType, upsert: false });
        if (error) throw new Error(`загрузка: ${error.message}`);
        return newSb.storage.from('event-photos').getPublicUrl(path).data.publicUrl;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      } finally {
        try { unlinkSync(tmp); } catch {}
      }
    }
    throw lastErr;
  }

  // воспоминания (сохраняем дату created_at, тип, заметку, фото)
  let movedPhotos = 0;
  for (const ev of events) {
    let photo_url = null;
    if (ev.photo_url) {
      try { photo_url = await movePhoto(ev.photo_url); movedPhotos++; }
      catch (e) { console.warn(`  ! фото не перенеслось (${e.message}) — воспоминание добавлю без фото`); }
    }
    const { error } = await newSb.from('events').insert({
      world_code: WORLD_CODE,
      type: ev.type,
      note: ev.note || '',
      photo_url,
      created_at: ev.created_at,
    });
    if (error) throw new Error(`Добавление воспоминания: ${error.message}`);
  }
  console.log(`✔ Перенесено воспоминаний: ${events.length} (из них с фото: ${movedPhotos}).`);

  // покупки (уникальны по world_code+item_key)
  if (purchases.length) {
    const { error } = await newSb.from('purchases')
      .upsert(purchases.map((p) => ({ world_code: WORLD_CODE, item_key: p.item_key })),
        { onConflict: 'world_code,item_key', ignoreDuplicates: true });
    if (error) throw new Error(`Перенос покупок: ${error.message}`);
  }
  // настройки (PK world_code+key)
  if (settings.length) {
    const { error } = await newSb.from('settings')
      .upsert(settings.map((s) => ({ world_code: WORLD_CODE, key: s.key, value: s.value, updated_at: new Date().toISOString() })),
        { onConflict: 'world_code,key' });
    if (error) throw new Error(`Перенос настроек: ${error.message}`);
  }
  // желания
  if (wishes.length) {
    const { error } = await newSb.from('wishes')
      .insert(wishes.map((w) => ({ world_code: WORLD_CODE, text: w.text, done: !!w.done, created_at: w.created_at })));
    if (error) throw new Error(`Перенос желаний: ${error.message}`);
  }
  console.log(`✔ Перенесено покупок: ${purchases.length}, настроек: ${settings.length}, желаний: ${wishes.length}.`);

  console.log(`\n✅ Готово. Остров ${WORLD_CODE} перенесён на новый сервер.`);
  console.log('   Открой приложение (копию), войди под новым аккаунтом — остров будет на месте.');
  console.log('   Партнёр заходит по коду-приглашению как обычно.\n');
}

main().catch((e) => {
  console.error(`\n✖ Ошибка переноса: ${e.message}\n`);
  process.exit(1);
});
