import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { TILE_MODELS } from './models';
import { TILE_SIZE } from './hexMath';

const loader = new GLTFLoader();

// type -> loaded THREE.Object3D (the model's root scene), or null if it failed to load
const cache = new Map();

// Hexagon geometry that the tiles are laid out on. APOTHEM is centre→flat-side;
// clipping each tile to this hexagon makes the (octagonal) model bases tessellate.
const APOTHEM = TILE_SIZE * Math.cos(Math.PI / 6); // ≈ 1.732
const FOOTPRINT = APOTHEM * 2;                     // flat-to-flat, matches grid spacing
const BASE_TOP = 0.6;                              // top of the procedural hex base

export function preloadModels() {
  const entries = Object.entries(TILE_MODELS);
  return Promise.all(
    entries.map(([type, cfg]) =>
      new Promise((resolve) => {
        loader.load(
          cfg.url,
          (gltf) => { cache.set(type, gltf.scene); resolve(); },
          undefined,
          (err) => {
            console.warn(`Модель для "${type}" не загрузилась (${cfg.url}) — встроенная графика.`, err);
            cache.set(type, null);
            resolve();
          }
        );
      })
    )
  );
}

// Vertical clipping planes forming a regular polygon around (tileX, tileZ) in
// WORLD space. Fragments outside any plane are discarded. 6 sides = hexagon that
// meets neighbours exactly; many sides ≈ a circle, for a soft rounded platform.
function polyClipPlanes(tileX, tileZ, sides, radius, angleOffset) {
  const planes = [];
  for (let k = 0; k < sides; k++) {
    const a = angleOffset + k * ((2 * Math.PI) / sides);
    const cos = Math.cos(a), sin = Math.sin(a);
    planes.push(new THREE.Plane(new THREE.Vector3(-cos, 0, -sin), cos * tileX + sin * tileZ + radius));
  }
  return planes;
}

// Returns a fresh model instance for a tile, auto-scaled to fill the hex, centred,
// sitting with its bottom at y=0, and clipped to the tile's hexagon so tiles
// tessellate. Returns null if there's no (loaded) model for this type.
// Builds one auto-fitted instance of a model: scaled to fill the hex footprint,
// centred in x/z, sitting with its bottom on the ground (y=0) + yOffset.
function makeInstance(source, cfg) {
  const object = cloneSkeleton(source);

  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const footprint = Math.max(size.x, size.z) || 1;
  const scale = (FOOTPRINT / footprint) * (cfg.scaleMul ?? 1);
  object.scale.setScalar(scale);

  object.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(object);
  const center = box2.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= box2.min.y;
  object.position.y += cfg.yOffset ?? 0;
  if (cfg.rotationY) object.rotation.y = cfg.rotationY;
  return object;
}

export function getTileModel(type, tileX = 0, tileZ = 0) {
  const cfg = TILE_MODELS[type];
  const source = cache.get(type);
  if (!cfg || !source) return null;

  const count = Math.max(1, cfg.count ?? 1);
  let root;
  if (count === 1) {
    root = makeInstance(source, cfg);
  } else {
    // scatter `count` copies across the tile (golden-angle spiral for even spread)
    root = new THREE.Group();
    const spread = cfg.spread ?? APOTHEM * 0.62;
    for (let i = 0; i < count; i++) {
      const inst = makeInstance(source, cfg);
      const ang = i * 2.399963;
      const rad = spread * Math.sqrt((i + 0.5) / count);
      inst.position.x += Math.cos(ang) * rad;
      inst.position.z += Math.sin(ang) * rad;
      inst.rotation.y += i * 1.1;
      root.add(inst);
    }
  }

  // crop to the tile hexagon (or a rounded shape), and clip away everything below
  // the base top so the model's own platform is hidden by the procedural hex base
  const planes = cfg.roundClip
    ? polyClipPlanes(tileX, tileZ, 18, APOTHEM * 0.97, 0)          // soft rounded platform
    : polyClipPlanes(tileX, tileZ, 6, APOTHEM, Math.PI / 6);       // hexagon, tessellates
  planes.push(new THREE.Plane(new THREE.Vector3(0, 1, 0), -BASE_TOP));
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = false; // models don't cast shadows — big perf win on phones
    o.receiveShadow = true;
    const src = Array.isArray(o.material) ? o.material : [o.material];
    const clipped = src.map((m) => {
      const c = m.clone();
      c.clippingPlanes = planes;
      // where a hollow wall gets sliced by the hex clip, DoubleSide renders the
      // wall's inner face instead of a see-through hole (used by e.g. the theatre)
      if (cfg.doubleSide) c.side = THREE.DoubleSide;
      c.needsUpdate = true;
      return c;
    });
    o.material = Array.isArray(o.material) ? clipped : clipped[0];
  });

  return { object: root, hideBase: !!cfg.hideBase };
}

// ---------- small models used by scene effects (birds, ducks, crocodiles) ----------
const EFFECT_MODEL_URLS = {
  chaika: '/models/Chaika.glb',
  duck: '/models/duck.glb',
  crocodile: '/models/Crocodile.glb',
  dolphin: '/models/Dolphin.glb',
  boat1: '/models/boat1.glb',
  boat2: '/models/boat2.glb',
  boat3: '/models/boat3.glb',
  winebottle: '/models/Wine bottle.glb',
  cloud: '/another/Cloud.glb',
  balloon: '/another/balloon.glb',
};
const effectCache = new Map();

export function preloadEffectModels() {
  return Promise.all(
    Object.entries(EFFECT_MODEL_URLS).map(([key, url]) =>
      new Promise((resolve) => {
        loader.load(
          url,
          (g) => { effectCache.set(key, g.scene); resolve(); },
          undefined,
          () => { effectCache.set(key, null); resolve(); }
        );
      })
    )
  );
}

// ---------- couple figures (пак «Для двоих») — loaded lazily, only when chosen ----------
const FIGURE_URLS = {
  boy_1: '/models/people/boy/1.glb',
  boy_2: '/models/people/boy/2.glb',
  boy_3: '/models/people/boy/3.glb',
  boy_4: '/models/people/boy/4.glb',
  boy_5: '/models/people/boy/5.glb',
  girl_1: '/models/people/girl/1.glb',
  girl_2: '/models/people/girl/2.glb',
  girl_3: '/models/people/girl/3.glb',
  girl_4: '/models/people/girl/4.glb',
  girl_5: '/models/people/girl/5.glb',
  girl_6: '/models/people/girl/6.glb',
};
const figureSourceCache = new Map();
const FIGURE_COLOR_MATERIALS = {
  shirt: ['cofta', 'shirt', 'top', 'body'],
  pants: ['shorts', 'pants', 'trousers', 'jeans'],
  face: ['skin', 'face'],
  hair: ['hair'],
};

function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

function colorPartForMaterial(materialName = '') {
  const name = materialName.toLowerCase();
  for (const [part, aliases] of Object.entries(FIGURE_COLOR_MATERIALS)) {
    if (aliases.some((alias) => name.includes(alias))) return part;
  }
  return null;
}

export function applyFigureColors(obj, colors = {}) {
  if (!obj || !colors) return obj;
  obj.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    const recolored = materials.map((material) => {
      const copy = material.clone();
      const part = colorPartForMaterial(copy.name);
      if (part && isHexColor(colors[part])) {
        copy.color = new THREE.Color(colors[part]);
        copy.needsUpdate = true;
      }
      return copy;
    });
    o.material = Array.isArray(o.material) ? recolored : recolored[0];
  });
  return obj;
}

function loadFigureSource(key) {
  if (!FIGURE_URLS[key]) return Promise.resolve(null);
  if (figureSourceCache.has(key)) return Promise.resolve(figureSourceCache.get(key));
  return new Promise((resolve) => {
    loader.load(
      FIGURE_URLS[key],
      (g) => { figureSourceCache.set(key, g.scene); resolve(g.scene); },
      undefined,
      (err) => { console.warn('Фигурка не загрузилась:', key, err); figureSourceCache.set(key, null); resolve(null); }
    );
  });
}

// Async: a fitted instance of a figure (scaled so its height ≈ targetSize, centred
// in x/z, feet at y=0), or null if unavailable. Loads the .glb on first use.
export async function getFigureModel(key, targetSize = 0.95, colors = null) {
  const src = await loadFigureSource(key);
  if (!src) return null;
  const obj = cloneSkeleton(src);
  obj.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  obj.scale.setScalar(targetSize / maxDim);
  obj.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(obj);
  const c = b2.getCenter(new THREE.Vector3());
  obj.position.x -= c.x;
  obj.position.z -= c.z;
  obj.position.y -= b2.min.y;
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  applyFigureColors(obj, colors);
  return obj;
}

// Cloned effect model scaled so its largest dimension ≈ targetSize, centred in
// x/z with its bottom at y=0. Returns null if the model isn't loaded.
export function getEffectModel(key, targetSize = 1) {
  const src = effectCache.get(key);
  if (!src) return null;
  const obj = cloneSkeleton(src);
  obj.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  obj.scale.setScalar(targetSize / maxDim);
  obj.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(obj);
  const c = b2.getCenter(new THREE.Vector3());
  obj.position.x -= c.x;
  obj.position.z -= c.z;
  obj.position.y -= b2.min.y;
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  return obj;
}
