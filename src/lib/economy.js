// Coin economy + shop catalog for the island.
//
// Design: coins are EARNED deterministically from the number of tiles (events),
// so both partners always compute the same amount. Purchases are recorded in
// Supabase (table `purchases`) and shared, so the balance is simply
//   earned(tiles) − spent(purchased items).
// There is no mutable "balance" field to get out of sync.

export const COINS_PER_TILE = 10;

// One-time bonuses the first time the island reaches these sizes.
export const MILESTONES = [
  { at: 5, bonus: 25 },
  { at: 10, bonus: 50 },
  { at: 25, bonus: 100 },
  { at: 50, bonus: 200 },
];

export function computeEarned(tileCount) {
  let coins = tileCount * COINS_PER_TILE;
  for (const m of MILESTONES) if (tileCount >= m.at) coins += m.bonus;
  return coins;
}

// Shop catalog. `price: 0` + `isDefault: true` are the free "reset" options for
// the exclusive categories (plain day sky / classic land palette) — always owned.
export const SHOP_ITEMS = [
  // Sky (exclusive: one active at a time)
  { key: 'sky_day',    category: 'sky', emoji: '☀️', iconPath: '/icons-shop/sun.svg', name: 'Обычный день',      price: 0,   isDefault: true, desc: 'Светлое дневное небо' },
  { key: 'sky_sunset', category: 'sky', emoji: '🌅', iconPath: '/icons-shop/sunset.svg', name: 'Закатное небо',     price: 60,  desc: 'Тёплый закат над островом' },
  { key: 'sky_night',  category: 'sky', emoji: '🌙', iconPath: '/icons-shop/moon.svg', name: 'Ночь со звёздами',  price: 80,  desc: 'Звёздное небо и мягкий лунный свет' },

  // Life & details (additive)
  { key: 'birds',      category: 'animals', emoji: '🐦', iconPath: '/icons-shop/sing birds.svg', name: 'Птицы',            price: 70,  desc: 'Птицы кружат над островом' },

  // Land palette (exclusive)
  { key: 'palette_classic', category: 'palette', emoji: '🎨', iconPath: '/icons-shop/palette.svg', name: 'Обычная палитра', price: 0,  isDefault: true, desc: 'Стандартные оттенки земли' },
  { key: 'palette_warm',    category: 'palette', emoji: '🎨', iconPath: '/icons-shop/palette.svg', name: 'Тёплая палитра',  price: 50, desc: 'Тёплые, золотистые оттенки' },
  { key: 'palette_cool',    category: 'palette', emoji: '🎨', iconPath: '/icons-shop/palette.svg', name: 'Прохладная палитра', price: 50, desc: 'Прохладные, свежие оттенки' },

  // Atmosphere (additive toggles)
  { key: 'atmo_stars',   category: 'atmosphere', emoji: '✨', iconPath: '/icons-shop/stars.svg', name: 'Звёздная ночь',   price: 60, desc: 'Звёзды и созвездия на небе' },
  { key: 'atmo_aurora',  category: 'atmosphere', emoji: '🌌', iconPath: '/icons-shop/northern lights.svg', name: 'Северное сияние', price: 90, desc: 'Переливы полярного сияния' },
  { key: 'atmo_rain',    category: 'atmosphere', emoji: '🌧️', iconPath: '/icons-shop/rain.svg', name: 'Лёгкий дождь',    price: 60, desc: 'Тёплый приятный дождик' },
  { key: 'atmo_snow',    category: 'atmosphere', emoji: '❄️', iconPath: '/icons-shop/snow.svg', name: 'Снег',            price: 60, desc: 'Падающие снежинки' },
  { key: 'atmo_leaves',  category: 'atmosphere', emoji: '🍂', iconPath: '/icons-shop/leaf fall.svg', name: 'Листопад',        price: 60, desc: 'Кружащиеся осенние листья' },
  { key: 'atmo_petals',  category: 'atmosphere', emoji: '🌸', iconPath: '/icons-shop/petals sakura.svg', name: 'Лепестки сакуры', price: 60, desc: 'Розовые лепестки в воздухе' },
  { key: 'atmo_rainbow', category: 'atmosphere', emoji: '🌈', iconPath: '/icons-shop/rainbow.svg', name: 'Радуга',          price: 70, desc: 'Радуга над островом' },
  { key: 'atmo_meteors', category: 'atmosphere', emoji: '☄️', iconPath: '/icons-shop/meteor shower.svg', name: 'Звездопад',       price: 80, desc: 'Падающие звёзды и кометы' },
  { key: 'atmo_clouds',  category: 'atmosphere', emoji: '☁️', name: 'Облака',            price: 60, desc: 'Несколько мягких облаков плывут над островом' },
  { key: 'atmo_balloons', category: 'atmosphere', emoji: '🎈', iconPath: '/icons-shop/balloon.svg', name: 'Воздушные шары',    price: 70, desc: 'Несколько шаров медленно парят вокруг острова' },
  // Pack "Для двоих" — premium later; free (price 0) for now while we build the pack
  { key: 'atmo_fireworks', category: 'atmosphere', emoji: '🎆', name: 'Фейерверк',        price: 0,  desc: 'Праздничные залпы над островом' },
  { key: 'atmo_hearts',    category: 'atmosphere', emoji: '💕', name: 'Сердечки',         price: 0,  desc: 'Сердечки нежно парят над островом' },
  // Морской пак — премиум (открывается паком, поэтому price 0)
  { key: 'atmo_waves',     category: 'atmosphere', emoji: '🌊', name: 'Волны и пена',     price: 0,  desc: 'Пенные волны плещут у берега острова' },
  { key: 'life_plaque',    category: 'life',       emoji: '🪧', name: 'Табличка с названием', price: 0, desc: 'Деревянная табличка с названием вашего острова' },
  // Бутылка с запиской — бесплатная, вне паков; нажмите на неё, чтобы написать записку
  { key: 'life_bottle',    category: 'life',       emoji: '🍾', name: 'Бутылка с запиской', price: 0, desc: 'Плавает в море. Нажмите на неё, чтобы написать записку' },

  // Couple figures — пак «Для двоих». Pick a "him" AND a "her" outfit separately
  // (each is exclusive). Nothing is shown until you choose. Free for now.
  { key: 'boy_none', category: 'boy', emoji: '🚫', name: 'Без фигурки', price: 0, isDefault: true, desc: 'Не показывать фигурку' },
  { key: 'boy_1', category: 'boy', emoji: '🧑', name: 'Наряд 1', price: 0, desc: 'Вариант одежды' },
  { key: 'boy_2', category: 'boy', emoji: '🧑', name: 'Наряд 2', price: 0, desc: 'Вариант одежды' },
  { key: 'boy_3', category: 'boy', emoji: '🧑', name: 'Наряд 3', price: 0, desc: 'Вариант одежды' },
  { key: 'boy_4', category: 'boy', emoji: '🧑', name: 'Наряд 4', price: 0, desc: 'Вариант одежды' },
  { key: 'boy_5', category: 'boy', emoji: '🧑', name: 'Наряд 5', price: 0, desc: 'Вариант одежды' },
  { key: 'girl_none', category: 'girl', emoji: '🚫', name: 'Без фигурки', price: 0, isDefault: true, desc: 'Не показывать фигурку' },
  { key: 'girl_1', category: 'girl', emoji: '👩', name: 'Наряд 1', price: 0, desc: 'Вариант одежды' },
  { key: 'girl_2', category: 'girl', emoji: '👩', name: 'Наряд 2', price: 0, desc: 'Вариант одежды' },
  { key: 'girl_3', category: 'girl', emoji: '👩', name: 'Наряд 3', price: 0, desc: 'Вариант одежды' },
  { key: 'girl_4', category: 'girl', emoji: '👩', name: 'Наряд 4', price: 0, desc: 'Вариант одежды' },
  { key: 'girl_5', category: 'girl', emoji: '👩', name: 'Наряд 5', price: 0, desc: 'Вариант одежды' },
  { key: 'girl_6', category: 'girl', emoji: '👩', name: 'Наряд 6', price: 0, desc: 'Вариант одежды' },

  // Sea colour (exclusive)
  { key: 'sea_blue',      category: 'sea', emoji: '🌊', iconPath: '/icons-shop/blue sea.svg', name: 'Синее море',      price: 0,  isDefault: true, desc: 'Классический спокойный цвет моря' },
  { key: 'sea_turquoise', category: 'sea', emoji: '🩵', iconPath: '/icons-shop/blue sea.svg', name: 'Бирюзовое море',  price: 40, desc: 'Светлая тропическая вода вокруг острова' },
  { key: 'sea_deep',      category: 'sea', emoji: '🌌', iconPath: '/icons-shop/blue sea.svg', name: 'Глубокое море',   price: 40, desc: 'Более тёмный и насыщенный оттенок воды' },
  { key: 'sea_sunset',    category: 'sea', emoji: '🌅', iconPath: '/icons-shop/blue sea.svg', name: 'Закатное море',   price: 40, desc: 'Тёплый цвет воды, как в вечернем свете' },

  // Boat (exclusive: one boat at a time) — морской пак. Pick which boat sails the sea.
  { key: 'boat_none', category: 'boat', emoji: '🚫', name: 'Без кораблика', price: 0, isDefault: true, desc: 'Не показывать кораблик' },
  { key: 'boat_1',    category: 'boat', emoji: '⛵', name: 'Кораблик 1',    price: 0, desc: 'Плывёт по морю вокруг острова' },
  { key: 'boat_2',    category: 'boat', emoji: '⛵', name: 'Кораблик 2',    price: 0, desc: 'Плывёт по морю вокруг острова' },
  { key: 'boat_3',    category: 'boat', emoji: '⛵', name: 'Кораблик 3',    price: 0, desc: 'Плывёт по морю вокруг острова' },

  // Animals (additive; ducks/swans require a lake tile)
  { key: 'animal_butterflies', category: 'animals', emoji: '🦋', iconPath: '/icons-shop/butterflies.svg', name: 'Бабочки',          price: 60, desc: 'Порхают над островом' },
  { key: 'animal_ducks',       category: 'animals', emoji: '🦆', iconPath: '/icons-shop/duck.svg', name: 'Уточки на озере',  price: 80, desc: 'Плавают по озеру', requires: 'lake' },
  { key: 'animal_swans',       category: 'animals', emoji: '🦢', iconPath: '/icons-shop/swans.svg', name: 'Лебеди на озере',  price: 90, desc: 'Скользят по озеру', requires: 'lake' },
  { key: 'animal_dolphins',    category: 'animals', emoji: '🐬', name: 'Дельфины',         price: 0,  desc: 'Плавают в море и выпрыгивают из воды' }, // морской пак

  // Sounds (additive toggles; need audio files in public/sounds/)
  { key: 'sound_rain',      category: 'sounds', emoji: '🌧️', iconPath: '/icons-shop/rain.svg', name: 'Шум дождя',            price: 40, desc: 'Уютный звук дождя', sound: true },
  { key: 'sound_birds',     category: 'sounds', emoji: '🐦', iconPath: '/icons-shop/sing birds.svg', name: 'Пение птиц',           price: 40, desc: 'Птичьи трели', sound: true },
  { key: 'sound_campfire',  category: 'sounds', emoji: '🔥', iconPath: '/icons-shop/fire.svg', name: 'Потрескивание костра', price: 40, desc: 'Треск дров', sound: true },
  { key: 'sound_waterfall', category: 'sounds', emoji: '💧', iconPath: '/icons-shop/water.svg', name: 'Звук водопада',        price: 40, desc: 'Журчание воды', sound: true },
  { key: 'sound_crickets',  category: 'sounds', emoji: '🦗', iconPath: '/icons-shop/crickets.svg', name: 'Ночные сверчки',       price: 40, desc: 'Стрёкот сверчков', sound: true },
  { key: 'sound_wind',      category: 'sounds', emoji: '🍃', iconPath: '/icons-shop/wind.svg', name: 'Ветер',                price: 40, desc: 'Шелест ветра', sound: true },
  // Морской пак — премиум (открывается паком, поэтому price 0)
  { key: 'sound_ocean',      category: 'sounds', emoji: '🌊', name: 'Шум океана',   price: 0, desc: 'Спокойный шум океанских волн', sound: true },
  { key: 'sound_underwater', category: 'sounds', emoji: '🫧', name: 'Под водой',     price: 0, desc: 'Приглушённые звуки под водой', sound: true },
];

export const SHOP_ITEMS_BY_KEY = Object.fromEntries(SHOP_ITEMS.map((i) => [i.key, i]));

export const FIGURE_CHOICES = {
  boy: ['boy_1'],
  girl: ['girl_1', 'girl_3'],
};

// Premium packs. An item that belongs to a pack needs the pack to be OWNED
// (bought) — or a trial active — before it can actually be used. The purchase is
// a free stub for now; the trial applies changes locally without saving them.
export const PACKS = {
  dvoih: {
    key: 'dvoih',
    items: [
      'atmo_fireworks', 'atmo_hearts', 'life_plaque',
      ...FIGURE_CHOICES.boy,
      ...FIGURE_CHOICES.girl,
    ],
  },
  more: {
    key: 'more',
    items: ['animal_dolphins', 'atmo_waves', 'boat_1', 'boat_2', 'boat_3', 'sound_ocean', 'sound_underwater'],
  },
};

export function packForItem(key) {
  for (const p of Object.values(PACKS)) if (p.items.includes(key)) return p.key;
  return null;
}
export function isPackOwned(ownedPacksStr, pack) {
  return parseKeySet(ownedPacksStr).has(pack);
}

export const CATEGORIES = [
  { key: 'sky', label: 'Небо' },
  { key: 'atmosphere', label: 'Атмосфера' },
  { key: 'animals', label: 'Животные' },
  { key: 'sounds', label: 'Звуки' },
  { key: 'life', label: 'Детали' },
  // boy/girl figures are chosen in the dedicated Figure Picker ("Примерочная"),
  // not as plain shop tabs — so they're intentionally absent from CATEGORIES.
  { key: 'sea', label: 'Море' },
  { key: 'boat', label: 'Кораблик' },
  { key: 'palette', label: 'Палитра' },
];

// Categories where only one item is "active" at a time (chosen via settings).
// All other categories are additive on/off toggles.
export const EXCLUSIVE_CATEGORIES = ['sky', 'palette', 'sea', 'boy', 'girl', 'boat'];

export function isExclusiveCategory(category) {
  return EXCLUSIVE_CATEGORIES.includes(category);
}

export const DEFAULT_SETTINGS = {
  active_sky: 'sky_day',
  active_palette: 'palette_classic',
  active_sea: 'sea_blue',
  effects_off: '', // comma-separated keys of owned additive effects turned OFF
  island_name: '', // shown on the plaque (пак «Для двоих»); shared by both partners
  active_boy: 'boy_none',   // chosen "him" figure outfit ('boy_none' = none)
  active_girl: 'girl_none', // chosen "her" figure outfit ('girl_none' = none)
  active_boat: 'boat_none', // chosen boat ('boat_none' = none); морской пак
  boy_colors: '',           // JSON with custom figure colors: shirt, pants, face, hair
  girl_colors: '',          // JSON with custom figure colors: shirt, pants, face, hair
  owned_packs: '',          // comma-separated premium packs the couple has unlocked
  bottle_note: '',          // the couple's message in a bottle (free); shared by both
  jar_notes: '',            // (legacy single jar — kept for older data)
  jar_notes_a: '',          // reasons about partner A: A pulls from here, B writes here
  jar_notes_b: '',          // reasons about partner B: B pulls from here, A writes here
  name_a: '',               // partner A's name (shared, so both see it)
  name_b: '',               // partner B's name
};

export function settingKeyForCategory(category) {
  return category === 'sky' ? 'active_sky'
    : category === 'palette' ? 'active_palette'
    : category === 'sea' ? 'active_sea'
    : category === 'boy' ? 'active_boy'
    : category === 'girl' ? 'active_girl'
    : category === 'boat' ? 'active_boat'
    : null;
}

export function parseKeySet(str) {
  return new Set((str || '').split(',').filter(Boolean));
}
export function stringifyKeySet(set) {
  return Array.from(set).join(',');
}

// The "100 reasons to love you" jar is stored as a JSON array of { id, text }
// inside the shared `jar_notes` setting (no extra Supabase table needed).
export function parseJarNotes(str) {
  try {
    const arr = JSON.parse(str || '[]');
    return Array.isArray(arr) ? arr.filter((n) => n && typeof n.text === 'string') : [];
  } catch {
    return [];
  }
}
export function stringifyJarNotes(arr) {
  return JSON.stringify(arr);
}

// Owned additive effect is active unless it's in the "off" set. Returns the list
// of active additive effect keys (sky/palette are exclusive and handled separately).
export function computeActiveEffects(purchasedKeys, effectsOffStr) {
  const off = parseKeySet(effectsOffStr);
  const boughtEffects = SHOP_ITEMS
    .filter((i) => !isExclusiveCategory(i.category) && !i.isDefault)
    .filter((i) => purchasedKeys.includes(i.key) && !off.has(i.key))
    .map((i) => i.key);
  return ['sea', ...boughtEffects];
}

// TEST MODE: everything is free so effects are easy to try out. Set to false to
// bring back coin prices.
export const FREE_MODE = false;

export function itemPrice(key) {
  if (FREE_MODE) return 0;
  return SHOP_ITEMS_BY_KEY[key]?.price ?? 0;
}

// Money already spent = sum of prices of purchased (non-default) items.
export function computeSpent(purchasedKeys) {
  return purchasedKeys.reduce((sum, k) => sum + itemPrice(k), 0);
}

export function computeBalance(tileCount, purchasedKeys) {
  return computeEarned(tileCount) - computeSpent(purchasedKeys);
}

// An item is owned if it was bought, or it is a free default.
export function isOwned(key, purchasedKeys) {
  return SHOP_ITEMS_BY_KEY[key]?.isDefault || purchasedKeys.includes(key);
}
