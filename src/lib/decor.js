// Каталог декора и хранение раскладки. Предметы декора расставляются на травяных
// площадках острова. Раскладка и площадки хранятся в настройках (таблица settings),
// поэтому НЕ нужна миграция БД и они синхронизируются между партнёрами.

// Каталог. Расширяется добавлением строки + модели в public/decor.
//   size — примерная высота модели в мире (тайл = 2.0, верх базы y=0.6)
export const DECOR_ITEMS = [
  { key: 'lamp', name: 'Фонарь', url: '/decor/lamp.glb', icon: '🏮', price: 0, size: 1.15 },
];

export const DECOR_BY_KEY = Object.fromEntries(DECOR_ITEMS.map((d) => [d.key, d]));

// ---------- площадки (мини-островки): массив клеток {q,r} ----------
export function parsePlots(str) {
  try {
    const arr = JSON.parse(str || '[]');
    return Array.isArray(arr)
      ? arr.filter((p) => p && Number.isFinite(p.q) && Number.isFinite(p.r))
      : [];
  } catch {
    return [];
  }
}
export function stringifyPlots(arr) {
  return JSON.stringify(arr.map((p) => ({ q: p.q, r: p.r })));
}
export const plotKey = (q, r) => `${q},${r}`;

// ---------- расставленный декор: массив {id, key, x, z, rot} ----------
export function parseDecor(str) {
  try {
    const arr = JSON.parse(str || '[]');
    return Array.isArray(arr)
      ? arr.filter((d) => d && d.key && Number.isFinite(d.x) && Number.isFinite(d.z))
          .map((d) => ({ id: d.id || genDecorId(), key: d.key, x: d.x, z: d.z, rot: d.rot || 0 }))
      : [];
  } catch {
    return [];
  }
}
export function stringifyDecor(arr) {
  return JSON.stringify(arr.map((d) => ({ id: d.id, key: d.key, x: d.x, z: d.z, rot: d.rot || 0 })));
}
export function genDecorId() {
  return 'd' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
}

// ---------- склад: сколько каждого предмета куплено, но не поставлено ----------
export function parseInventory(str) {
  try {
    const o = JSON.parse(str || '{}');
    if (!o || typeof o !== 'object') return {};
    const out = {};
    for (const k of Object.keys(o)) if (Number.isFinite(o[k]) && o[k] > 0) out[k] = o[k];
    return out;
  } catch {
    return {};
  }
}
export function stringifyInventory(obj) {
  const out = {};
  for (const k of Object.keys(obj || {})) if (obj[k] > 0) out[k] = obj[k];
  return JSON.stringify(out);
}
