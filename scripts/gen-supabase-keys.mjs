// =====================================================================
//  Генератор ключей для СВОЕГО Supabase (self-hosted).
//  При установке Supabase нужно задать секрет JWT_SECRET и получить из него
//  два ключа: ANON_KEY (публичный, идёт в приложение) и SERVICE_ROLE_KEY
//  (секретный, только для сервера). Этот скрипт делает их без лишних программ.
//
//  КАК ЗАПУСТИТЬ (из папки relationship-island-ru):
//    node scripts/gen-supabase-keys.mjs "ТВОЙ-СЕКРЕТ-JWT"
//
//  Если секрет не указать — скрипт сам придумает надёжный (40 символов) и
//  покажет его: тогда используй и его (как JWT_SECRET), и оба ключа.
//
//  Куда вставлять (в файл .env установки Supabase на сервере):
//    JWT_SECRET=<секрет>           ANON_KEY=<первый ключ>
//    SERVICE_ROLE_KEY=<второй ключ>
//  ANON_KEY потом пойдёт в приложение как VITE_SUPABASE_ANON_KEY.
// =====================================================================

import { createHmac, randomBytes } from 'node:crypto';

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function makeJwt(secret, role) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 60 * 60 * 24 * 365 * 10; // 10 лет
  const payload = { role, iss: 'supabase', iat, exp };
  const head = b64url(JSON.stringify(header));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac('sha256', secret).update(`${head}.${body}`).digest());
  return `${head}.${body}.${sig}`;
}

let secret = process.argv[2];
let generated = false;
if (!secret) {
  secret = b64url(randomBytes(32)); // ~43 символа, надёжно
  generated = true;
}
if (secret.length < 32) {
  console.error('✖ JWT_SECRET слишком короткий. Нужно минимум 32 символа.');
  process.exit(1);
}

console.log('\n=== Ключи для твоего Supabase ===\n');
if (generated) console.log('JWT_SECRET (запиши и вставь на сервере):\n  ' + secret + '\n');
console.log('ANON_KEY (публичный — пойдёт в приложение как VITE_SUPABASE_ANON_KEY):\n  ' + makeJwt(secret, 'anon') + '\n');
console.log('SERVICE_ROLE_KEY (СЕКРЕТНЫЙ — только для сервера, никому не показывать):\n  ' + makeJwt(secret, 'service_role') + '\n');
