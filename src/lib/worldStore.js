import { supabase } from './supabaseClient';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export async function createWorld() {
  // Preferred path: a SECURITY DEFINER function creates the world AND the creator's
  // membership atomically. This lets us forbid direct writes to world_members (so a
  // world code alone can't be used to self-join), while creating still works.
  const { data, error } = await supabase.rpc('create_world');
  if (!error && data) return data;
  // "function not found" (PGRST202) = the hardening SQL isn't applied yet → fall
  // back to the original direct method, which still works under the old policies.
  if (error && error.code !== 'PGRST202' && !/create_world/i.test(error.message || '')) throw error;
  return createWorldLegacy();
}

// Original direct-insert create, kept as a fallback until create_world() is added.
async function createWorldLegacy() {
  const uid = await currentUserId();
  // Codes are random out of ~1.07 billion, so a clash is very rare — but if one
  // ever happens (Postgres unique violation 23505) just try a fresh code. Any
  // other error is a real failure and is thrown right away.
  let code = null;
  for (let attempt = 0; attempt < 5 && !code; attempt++) {
    const candidate = generateCode();
    const { error } = await supabase.from('worlds').insert({ code: candidate });
    if (!error) { code = candidate; break; }
    if (error.code !== '23505') throw error;
  }
  if (!code) throw new Error('could not allocate a unique island code');
  // becoming a member is what grants ongoing access to the world we just made
  const { error: memberErr } = await supabase
    .from('world_members')
    .insert({ world_code: code, user_id: uid });
  if (memberErr) throw memberErr;
  return code;
}

export async function worldExists(code) {
  const { data, error } = await supabase.from('worlds').select('code').eq('code', code).maybeSingle();
  if (error) throw error;
  return !!data;
}

// Join a world by its invite code: adds the current user as a member. Idempotent —
// rejoining a world you're already in is a no-op.
export async function joinWorld(code) {
  const uid = await currentUserId();
  const { error } = await supabase
    .from('world_members')
    .upsert({ world_code: code, user_id: uid }, { onConflict: 'world_code,user_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function createWorldInvite(code) {
  const { data, error } = await supabase.rpc('create_world_invite', { wc: code });
  if (error) throw error;
  return data;
}

export async function acceptWorldInvite(inviteCode) {
  const { data, error } = await supabase.rpc('accept_world_invite', { invite_code: inviteCode });
  if (error) throw error;
  return data;
}

// Emergency recovery code: a long secret the couple saves. If both lose their
// accounts, redeeming it from any logged-in account rejoins the island.
export async function setRecoveryCode(code) {
  const { data, error } = await supabase.rpc('set_recovery_code', { wc: code });
  if (error) throw error;
  return data;
}

export async function redeemRecoveryCode(recoveryCode) {
  const { data, error } = await supabase.rpc('redeem_recovery_code', { rc: recoveryCode });
  if (error) throw error;
  return data;
}

// Worlds this account already belongs to (used to reopen the island after login).
// Ordered newest-first so that, when a device has no specific saved island, the
// most recently created/joined one opens — deterministic instead of arbitrary.
export async function fetchMyWorlds() {
  const uid = await currentUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('world_members')
    .select('world_code')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((r) => r.world_code);
}

export async function fetchEvents(code) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('world_code', code)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data.map(rowToEvent);
}

export async function insertEvent(code, { type, note, photoFile, date }) {
  let photo_url = null;
  if (photoFile) {
    photo_url = await uploadPhoto(code, photoFile);
  }
  const row = { world_code: code, type, note: note || '', photo_url };
  // custom memory date is stored as created_at (no schema change needed); the
  // island then grows in chronological order of the memories
  if (date) row.created_at = new Date(date).toISOString();
  const { data, error } = await supabase
    .from('events')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return rowToEvent(data);
}

export async function updateEvent(code, id, { type, note, photoFile, date }) {
  const patch = {};
  if (type !== undefined) patch.type = type;
  if (note !== undefined) patch.note = note || '';
  if (date) patch.created_at = new Date(date).toISOString();
  if (photoFile) patch.photo_url = await uploadPhoto(code, photoFile);
  const { data, error } = await supabase
    .from('events')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return rowToEvent(data);
}

export async function deleteEvent(id) {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
}

async function uploadPhoto(code, file) {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${code}/${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`;
  const { error } = await supabase.storage.from('event-photos').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('event-photos').getPublicUrl(path);
  return data.publicUrl;
}

// Compresses an image client-side before upload so a photo never blocks on a slow
// connection or eats mobile data unnecessarily. Returns a File-like Blob.
export function compressImage(file, maxWidth = 1280, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })),
          'image/jpeg',
          quality
        );
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function subscribeToEvents(code, onInsert) {
  const channel = supabase
    .channel(`events:${code}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'events', filter: `world_code=eq.${code}` },
      (payload) => onInsert(rowToEvent(payload.new))
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ---------- shop: purchases & settings (shared per world code) ----------

export async function fetchPurchases(code) {
  const { data, error } = await supabase
    .from('purchases')
    .select('item_key')
    .eq('world_code', code);
  if (error) throw error;
  return data.map((r) => r.item_key);
}

export async function addPurchase(code, itemKey) {
  const { error } = await supabase
    .from('purchases')
    .insert({ world_code: code, item_key: itemKey });
  if (error) throw error;
}

export function subscribeToPurchases(code, onInsert) {
  const channel = supabase
    .channel(`purchases:${code}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'purchases', filter: `world_code=eq.${code}` },
      (payload) => onInsert(payload.new.item_key)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function fetchSettings(code) {
  const { data, error } = await supabase
    .from('settings')
    .select('key,value')
    .eq('world_code', code);
  if (error) throw error;
  const out = {};
  data.forEach((r) => { out[r.key] = r.value; });
  return out;
}

export async function setSetting(code, key, value) {
  const { error } = await supabase
    .from('settings')
    .upsert({ world_code: code, key, value, updated_at: new Date().toISOString() }, { onConflict: 'world_code,key' });
  if (error) throw error;
}

export function subscribeToSettings(code, onChange) {
  const channel = supabase
    .channel(`settings:${code}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'settings', filter: `world_code=eq.${code}` },
      (payload) => onChange(payload.new.key, payload.new.value)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ---------- wishes: "Хотим вместе" (shared per world code) ----------

export async function fetchWishes(code) {
  const { data, error } = await supabase
    .from('wishes')
    .select('*')
    .eq('world_code', code)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data.map(rowToWish);
}

export async function addWish(code, text) {
  const { data, error } = await supabase
    .from('wishes')
    .insert({ world_code: code, text, done: false })
    .select()
    .single();
  if (error) throw error;
  return rowToWish(data);
}

export async function updateWish(id, fields) {
  const { error } = await supabase.from('wishes').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteWish(id) {
  const { error } = await supabase.from('wishes').delete().eq('id', id);
  if (error) throw error;
}

export function subscribeToWishes(code, onChange) {
  const channel = supabase
    .channel(`wishes:${code}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'wishes', filter: `world_code=eq.${code}` },
      () => onChange()
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

function rowToWish(row) {
  return { id: row.id, text: row.text, done: row.done };
}

function rowToEvent(row) {
  return {
    id: row.id,
    type: row.type,
    note: row.note,
    photo: row.photo_url,
    dateISO: row.created_at,
    date: new Date(row.created_at).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric',
    }),
  };
}
