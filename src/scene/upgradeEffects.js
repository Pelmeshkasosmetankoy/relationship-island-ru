import * as THREE from 'three';
import { TEXTURES } from './tileBuilders';
import { getEffectModel } from './modelLoader';
import { TILE_SIZE } from './hexMath';

// Sky / time-of-day presets. Each drives the background, fog and light colours,
// and whether a starfield is shown.
export const SKY_PRESETS = {
  sky_day: {
    bg: 0xbfe3f0, fog: 0xbfe3f0,
    hemiSky: 0xffffff, hemiGround: 0x9fae7f, hemiInt: 0.9,
    sunColor: 0xfff3d6, sunInt: 0.9, stars: false,
  },
  sky_sunset: {
    bg: 0xf7c39a, fog: 0xf2b184,
    hemiSky: 0xffd9b0, hemiGround: 0x8a6f5a, hemiInt: 0.85,
    sunColor: 0xffb066, sunInt: 1.0, stars: false,
  },
  sky_night: {
    bg: 0x161d38, fog: 0x161d38,
    hemiSky: 0x36406b, hemiGround: 0x1a2036, hemiInt: 0.55,
    sunColor: 0x9fb0e0, sunInt: 0.35, stars: true,
  },
};

// Multiplied over each tile's original base colours to re-tint the land.
export const PALETTE_TINTS = {
  palette_classic: 0xffffff,
  palette_warm: 0xffd9b0,
  palette_cool: 0xc8d8ff,
};

export const SEA_PRESETS = {
  sea_blue: 0x3f7ea8,
  sea_turquoise: 0x39b8b4,
  sea_deep: 0x244f8f,
  sea_sunset: 0xd28a68,
};

export function makeStars() {
  const count = 340;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // spread from near the horizon (low) up to mid-sky, so they're visible
    // without tilting the camera far up
    const R = 42 + Math.random() * 36;
    const el = (Math.random() * 40) * Math.PI / 180; // elevation 0°..40°, low near the horizon
    const theta = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(theta) * Math.cos(el) * R;
    positions[i * 3 + 1] = 2 + Math.sin(el) * R;
    positions[i * 3 + 2] = Math.sin(theta) * Math.cos(el) * R;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // sizeAttenuation:false → constant screen-space size, so stars stay visible
  // no matter how far away they are
  const mat = new THREE.PointsMaterial({
    color: 0xffffff, size: 2.2, sizeAttenuation: false,
    transparent: true, opacity: 0.95, depthWrite: false, fog: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.userData.disposable = true;
  return points;
}

export function makeSea(activeSea = 'sea_blue') {
  const geo = new THREE.CircleGeometry(120, 48);
  const mat = new THREE.MeshStandardMaterial({
    color: SEA_PRESETS[activeSea] ?? SEA_PRESETS.sea_blue, roughness: 0.5, metalness: 0.0,
    transparent: true, opacity: 0.92,
  });
  // give the sea its own copy of the water texture so its large tiling doesn't
  // affect the small lake/waterfall meshes that share TEXTURES.water
  if (TEXTURES.water) {
    const seaTex = TEXTURES.water.clone();
    seaTex.wrapS = seaTex.wrapT = THREE.RepeatWrapping;
    seaTex.repeat.set(34, 34);
    seaTex.needsUpdate = true;
    mat.map = seaTex;
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.28; // around the waterline of the hex bases (0..0.6)
  mesh.receiveShadow = true;
  mesh.userData.sea = true;
  mesh.userData.seaPreset = activeSea;
  mesh.userData.baseY = 0.28;
  mesh.userData.disposable = true;
  return mesh;
}

function makeBird() {
  const model = getEffectModel('chaika', 1.1); // seagull model over the island
  if (model) return model;
  const bird = new THREE.Group();
  const wingGeo = new THREE.ConeGeometry(0.12, 0.5, 4);
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a3a44, flatShading: true });
  const left = new THREE.Mesh(wingGeo, mat);
  left.rotation.z = Math.PI / 2;
  left.rotation.y = 0.5;
  left.position.x = -0.22;
  const right = left.clone();
  right.rotation.y = -0.5;
  right.position.x = 0.22;
  bird.add(left, right);
  return bird;
}

export function makeBirds() {
  const group = new THREE.Group();
  const spots = [
    { r: 11, y: 9.0, a: 0 },
    { r: 14, y: 10.5, a: 2.1 },
    { r: 9, y: 8.2, a: 4.2 },
  ];
  spots.forEach((s) => {
    const bird = makeBird();
    bird.position.set(Math.cos(s.a) * s.r, s.y, Math.sin(s.a) * s.r);
    bird.rotation.y = -s.a + Math.PI / 2; // face head-first along the flight path
    group.add(bird);
  });
  group.userData.birds = true;
  group.userData.disposable = true;
  return group;
}

// ---------- atmosphere & animal effects ----------
// Each builder returns a THREE.Object3D; if it has userData.update(t, dt) the
// render loop calls it every frame.

function fallingField({ count, color, size, speed, sway = 0, area = 22, top = 16, opacity = 0.85 }) {
  const pos = new Float32Array(count * 3);
  const spd = new Float32Array(count);
  const ph = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 2 * area;
    pos[i * 3 + 1] = Math.random() * top;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 2 * area;
    spd[i] = speed * (0.6 + Math.random() * 0.8);
    ph[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size, sizeAttenuation: true, transparent: true, opacity, depthWrite: false, fog: false });
  const pts = new THREE.Points(geo, mat);
  pts.userData.disposable = true;
  pts.userData.update = (t, dt) => {
    const p = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      p[i * 3 + 1] -= spd[i] * dt;
      if (sway) p[i * 3] += Math.sin(t * 1.4 + ph[i]) * sway * dt;
      if (p[i * 3 + 1] < 0.4) {
        p[i * 3 + 1] = top;
        p[i * 3] = (Math.random() - 0.5) * 2 * area;
        p[i * 3 + 2] = (Math.random() - 0.5) * 2 * area;
      }
    }
    geo.attributes.position.needsUpdate = true;
  };
  return pts;
}

function makeConstellationStars() {
  const group = new THREE.Group();
  group.add(makeStars());
  const linePts = [];
  for (let c = 0; c < 4; c++) {
    let x = (Math.random() - 0.5) * 70, y = 4 + Math.random() * 18, z = (Math.random() - 0.5) * 70;
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const nx = x + (Math.random() - 0.5) * 14, ny = y + (Math.random() - 0.5) * 8, nz = z + (Math.random() - 0.5) * 14;
      linePts.push(x, y, z, nx, ny, nz);
      x = nx; y = ny; z = nz;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePts), 3));
  group.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xbcd0ff, transparent: true, opacity: 0.6, fog: false })));
  group.userData.disposable = true;
  return group;
}

function makeMeteors() {
  const group = new THREE.Group();
  const meteors = [];
  for (let i = 0; i < 5; i++) {
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 1, fog: false, depthWrite: false })
    );
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.6, fog: false }));
    const m = new THREE.Group();
    m.add(head, trail);
    m.frustumCulled = false;
    group.add(m);
    meteors.push({ m, head, trail, t: Math.random() * 5, dur: 1.4, delay: 1.5 + Math.random() * 3 });
  }
  group.userData.disposable = true;
  group.userData.update = (t, dt) => {
    meteors.forEach((mo) => {
      mo.t += dt;
      const local = mo.t % (mo.dur + mo.delay);
      if (local < mo.dur) {
        const f = local / mo.dur;
        const x = 28 - f * 46, y = 40 - f * 34, z = -14 + f * 12;
        mo.head.position.set(x, y, z);
        const tp = mo.trail.geometry.attributes.position.array;
        tp[0] = x; tp[1] = y; tp[2] = z; tp[3] = x + 4; tp[4] = y + 3; tp[5] = z - 1.6;
        mo.trail.geometry.attributes.position.needsUpdate = true;
        const op = Math.sin(f * Math.PI);
        mo.head.material.opacity = op;
        mo.trail.material.opacity = op * 0.6;
        mo.m.visible = true;
      } else {
        mo.m.visible = false;
      }
    });
  };
  return group;
}

// Soft vertical gradient (transparent → opaque → transparent) used as an alphaMap
// to fade the edges of the aurora curtains and rainbow bands.
function softBandTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0.0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function makeAurora() {
  const group = new THREE.Group();
  const grad = softBandTexture();
  // full 360° curtains around the island, with soft top/bottom edges
  [0x4affa0, 0x7ad0ff, 0xb98cff].forEach((col, i) => {
    const R = 32 + i * 3;
    const geo = new THREE.CylinderGeometry(R, R, 20, 64, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.4, side: THREE.DoubleSide,
      depthWrite: false, fog: false, alphaMap: grad,
    });
    const cyl = new THREE.Mesh(geo, mat);
    cyl.position.y = 15 + i * 2;
    cyl.frustumCulled = false;
    cyl.userData.base = geo.attributes.position.array.slice();
    group.add(cyl);
  });
  group.userData.disposable = true;
  group.userData.update = (t) => {
    group.children.forEach((cyl, i) => {
      const p = cyl.geometry.attributes.position.array;
      const base = cyl.userData.base;
      for (let v = 0; v < p.length; v += 3) {
        const ang = Math.atan2(base[v + 2], base[v]);
        p[v + 1] = base[v + 1] + Math.sin(ang * 3 + t * 0.7 + i) * 1.8; // wavy curtain
      }
      cyl.geometry.attributes.position.needsUpdate = true;
      cyl.rotation.y = t * 0.03 * (i % 2 ? -1 : 1);
      cyl.material.opacity = 0.32 + 0.12 * Math.sin(t * 0.6 + i);
    });
  };
  return group;
}

function makeRainbow() {
  const group = new THREE.Group();
  const grad = softBandTexture();
  [0xff5b5b, 0xffa64d, 0xffe14d, 0x6be06b, 0x5bb8ff, 0x6b6bff, 0xb95bff].forEach((col, i) => {
    const geo = new THREE.TorusGeometry(24 + i * 0.9, 0.6, 10, 100, Math.PI);
    const arc = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.7, fog: false, depthWrite: false,
      alphaMap: grad, side: THREE.DoubleSide,
    }));
    arc.frustumCulled = false;
    group.add(arc);
  });
  group.position.set(-6, 0.5, -24);
  group.rotation.z = 0.06;
  group.userData.disposable = true;
  return group;
}

function makeButterfly(color) {
  const g = new THREE.Group();
  const wingGeo = new THREE.CircleGeometry(0.16, 8);
  const mat = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.95, flatShading: true });
  const l = new THREE.Mesh(wingGeo, mat); l.position.x = -0.12;
  const r = new THREE.Mesh(wingGeo, mat); r.position.x = 0.12;
  g.add(l, r);
  g.userData.wings = [l, r];
  return g;
}

function makeButterflies() {
  const group = new THREE.Group();
  const cols = [0xffb04a, 0xff6b8a, 0x8ab6ff, 0xffe14d];
  const items = [];
  for (let i = 0; i < 6; i++) {
    const b = makeButterfly(cols[i % cols.length]);
    group.add(b);
    items.push({ b, r: 4 + Math.random() * 8, y: 1.2 + Math.random() * 2.5, a: Math.random() * Math.PI * 2, spd: 0.3 + Math.random() * 0.4, ph: Math.random() * 6 });
  }
  group.userData.disposable = true;
  group.userData.update = (t, dt) => {
    items.forEach((it) => {
      it.a += it.spd * dt;
      it.b.position.set(Math.cos(it.a) * it.r, it.y + Math.sin(t * 2 + it.ph) * 0.5, Math.sin(it.a) * it.r);
      it.b.rotation.y = -it.a + Math.PI / 2;
      const flap = Math.sin(t * 12 + it.ph) * 0.9;
      it.b.userData.wings[0].rotation.y = flap;
      it.b.userData.wings[1].rotation.y = -flap;
    });
  };
  return group;
}

function makeCloudFallback() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.94 });
  [
    [-0.55, 0, 0, 0.55],
    [-0.12, 0.1, 0.02, 0.72],
    [0.42, 0, 0.03, 0.58],
    [0.05, -0.06, 0.18, 0.5],
  ].forEach(([x, y, z, s]) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(s, 14, 10), mat);
    puff.position.set(x, y, z);
    puff.scale.y = 0.55;
    group.add(puff);
  });
  return group;
}

function makeBalloonFallback(color = 0xe84a68) {
  const group = new THREE.Group();
  const balloon = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 16, 14),
    new THREE.MeshStandardMaterial({ color, roughness: 0.55 })
  );
  balloon.scale.y = 1.18;
  balloon.position.y = 0.55;
  const basket = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.18, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.8 })
  );
  basket.position.y = -0.05;
  const ropeMat = new THREE.LineBasicMaterial({ color: 0x6d543f });
  [[-0.11, -0.11], [0.11, -0.11], [-0.11, 0.11], [0.11, 0.11]].forEach(([x, z]) => {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x * 0.75, 0.28, z * 0.75),
      new THREE.Vector3(x, 0.02, z),
    ]);
    group.add(new THREE.Line(geo, ropeMat));
  });
  group.add(balloon, basket);
  return group;
}

function makeFloatingFleet({ kind, count, targetSize, radius, height, speed, bob, colors = [], placements = [] }) {
  const group = new THREE.Group();
  const items = [];
  for (let i = 0; i < count; i++) {
    const placement = placements[i] || {};
    let obj = getEffectModel(kind, targetSize * (placement.scale ?? 1));
    if (!obj) obj = kind === 'cloud' ? makeCloudFallback() : makeBalloonFallback(colors[i % colors.length]);
    obj.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false;
      o.receiveShadow = false;
      if (kind === 'cloud' && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const cloned = mats.map((m) => {
          const c = m.clone();
          c.color?.setHex(0xffffff);
          c.emissive?.setHex(0xffffff);
          if (c.emissiveIntensity !== undefined) c.emissiveIntensity = 0.08;
          c.transparent = true;
          c.opacity = Math.min(c.opacity ?? 1, placement.opacity ?? 0.96);
          c.depthWrite = false;
          c.fog = false;
          return c;
        });
        o.material = Array.isArray(o.material) ? cloned : cloned[0];
      }
    });
    const a = placement.angle ?? ((i / count) * Math.PI * 2 + Math.random() * 0.4);
    const r = placement.radius ?? (radius * (0.72 + Math.random() * 0.35));
    const y = placement.height ?? (height + (Math.random() - 0.5) * 2.2);
    obj.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    obj.rotation.y = -a + Math.PI / 2;
    group.add(obj);
    items.push({
      obj,
      a,
      r,
      y,
      speed: placement.speed ?? (speed * (0.75 + Math.random() * 0.5)),
      phase: Math.random() * Math.PI * 2,
      bob: placement.bob ?? bob,
    });
  }
  group.userData.disposable = true;
  group.userData.update = (t, dt) => {
    items.forEach((it) => {
      it.a += it.speed * dt;
      it.obj.position.set(
        Math.cos(it.a) * it.r,
        it.y + Math.sin(t * 0.9 + it.phase) * it.bob,
        Math.sin(it.a) * it.r
      );
      it.obj.rotation.y = -it.a + Math.PI / 2;
    });
  };
  return group;
}

function makeClouds() {
  return makeFloatingFleet({
    kind: 'cloud',
    count: 7,
    targetSize: 5.2,
    radius: 18,
    height: 11.5,
    speed: 0.025,
    bob: 0.22,
    placements: [
      { angle: -0.22, radius: 9.5, height: 7.8, scale: 0.78, speed: 0.012, bob: 0.12, opacity: 0.98 },
      { angle: 0.74, radius: 14.5, height: 10.1, scale: 0.95, speed: 0.018, bob: 0.18, opacity: 0.98 },
      { angle: 1.58, radius: 24.0, height: 13.6, scale: 0.74, speed: 0.011, bob: 0.15, opacity: 0.9 },
      { angle: 2.45, radius: 33.0, height: 16.4, scale: 0.58, speed: 0.008, bob: 0.1, opacity: 0.82 },
      { angle: 3.45, radius: 18.5, height: 11.8, scale: 0.86, speed: 0.016, bob: 0.2, opacity: 0.94 },
      { angle: 4.36, radius: 29.0, height: 15.2, scale: 0.66, speed: 0.009, bob: 0.12, opacity: 0.86 },
      { angle: 5.38, radius: 11.2, height: 8.7, scale: 0.82, speed: 0.014, bob: 0.16, opacity: 0.98 },
    ],
  });
}

function makeBalloons() {
  return makeFloatingFleet({
    kind: 'balloon',
    count: 6,
    targetSize: 1.55,
    radius: 14,
    height: 7.6,
    speed: 0.045,
    bob: 0.35,
    colors: [0xe8505b, 0xf2b84b, 0x5ca7e8, 0x8fcf68, 0xb779d6],
    placements: [
      { angle: 0.15, radius: 7.8, height: 5.5, scale: 1.08, speed: 0.025, bob: 0.28 },
      { angle: 0.96, radius: 13.0, height: 7.2, scale: 0.95, speed: 0.032, bob: 0.32 },
      { angle: 1.92, radius: 21.0, height: 9.4, scale: 0.76, speed: 0.021, bob: 0.25 },
      { angle: 2.92, radius: 30.0, height: 11.2, scale: 0.58, speed: 0.014, bob: 0.18 },
      { angle: 4.08, radius: 16.5, height: 8.3, scale: 0.88, speed: 0.028, bob: 0.34 },
      { angle: 5.34, radius: 25.0, height: 10.5, scale: 0.68, speed: 0.018, bob: 0.22 },
    ],
  });
}

function findTilePositions(islandGroup, type) {
  const out = [];
  islandGroup.children.forEach((c) => { if (c.userData.type === type) out.push(c.position); });
  return out;
}

function makeWaterBird(kind) {
  // swans slot → crocodile model (small); ducks → duck model
  const model = getEffectModel(kind === 'swan' ? 'crocodile' : 'duck', kind === 'swan' ? 0.85 : 0.5);
  if (model) return model;
  const g = new THREE.Group();
  const white = kind === 'swan';
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: white ? 0xffffff : 0x8a6a3a, flatShading: true }));
  body.scale.set(1.3, 0.8, 0.9);
  g.add(body);
  if (white) {
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.4, 6), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    neck.position.set(0.22, 0.22, 0); neck.rotation.z = -0.5; g.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    head.position.set(0.36, 0.4, 0); g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 6), new THREE.MeshStandardMaterial({ color: 0xe8862a }));
    beak.position.set(0.45, 0.4, 0); beak.rotation.z = -Math.PI / 2; g.add(beak);
  } else {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3a6a3a, flatShading: true }));
    head.position.set(0.28, 0.16, 0); g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 6), new THREE.MeshStandardMaterial({ color: 0xe8b02a }));
    beak.position.set(0.4, 0.14, 0); beak.rotation.z = -Math.PI / 2; g.add(beak);
  }
  return g;
}

function makeWaterBirds(kind, islandGroup) {
  const group = new THREE.Group();
  group.userData.disposable = true;
  const spots = findTilePositions(islandGroup, 'lake'); // one flock per pond
  if (!spots.length) return group; // no pond → nothing (purchase is gated separately)
  const items = [];
  const n = kind === 'swan' ? 2 : 3;
  spots.forEach((pos) => {
    const cx = pos.x, cz = pos.z, y = 0.95;
    for (let i = 0; i < n; i++) {
      const b = makeWaterBird(kind);
      group.add(b);
      items.push({ b, cx, cz, y, r: 0.5 + Math.random() * 0.6, a: Math.random() * Math.PI * 2, spd: 0.15 + Math.random() * 0.15, ph: Math.random() * 6 });
    }
  });
  group.userData.update = (t) => {
    items.forEach((it) => {
      it.a += it.spd * 0.016;
      it.b.position.set(it.cx + Math.cos(it.a) * it.r, it.y + Math.sin(t * 1.5 + it.ph) * 0.03, it.cz + Math.sin(it.a) * it.r);
      it.b.rotation.y = -it.a + Math.PI / 2; // face head-first along the swim path
    });
  };
  return group;
}

// Simple grey dolphin used if Dolphin.glb fails to load: a curved body, a dorsal
// fin and a tail fluke. Built facing +X (like the other effect models) so the
// swim/leap code can orient it the same way.
function makeDolphinFallback() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0x6f8b9e, roughness: 0.5, metalness: 0.05 });
  const belly = new THREE.MeshStandardMaterial({ color: 0xd8e2e8, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), skin);
  body.scale.set(1.6, 0.62, 0.62); // stretch along +X into a torpedo shape
  g.add(body);
  const under = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), belly);
  under.scale.set(1.4, 0.4, 0.5);
  under.position.set(0.05, -0.12, 0);
  g.add(under);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 12), skin);
  snout.rotation.z = -Math.PI / 2; snout.position.set(0.85, 0.02, 0);
  g.add(snout);
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 10), skin);
  dorsal.position.set(-0.05, 0.42, 0); dorsal.rotation.x = -0.2;
  g.add(dorsal);
  const fluke = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.36, 4), skin);
  fluke.rotation.z = Math.PI / 2; fluke.scale.set(1, 1, 0.35); fluke.position.set(-0.86, 0, 0);
  g.add(fluke);
  return g;
}

// Turns the raw dolphin model so its nose points along +X (the direction the swim
// code aims it). The model was leaping "sideways" because its own nose faces a
// different axis — this offset corrects it. If it still looks wrong, this is the
// one knob to turn: ±Math.PI/2 rotates it 90°, +Math.PI flips it head-to-tail.
const DOLPHIN_MODEL_YAW = Math.PI / 2;

// Distance from the island's centre to its farthest tile — grows as memories are
// added. Dolphins use it to keep their ring just off the coast: close when the
// island is tiny, further out as it spreads so they never swim over a location.
function islandOuterRadius(islandGroup) {
  let maxR = 0;
  islandGroup.children.forEach((c) => {
    if (!c.userData.tileId) return;
    const r = Math.hypot(c.position.x, c.position.z);
    if (r > maxR) maxR = r;
  });
  return maxR;
}

// Dolphins in the sea around the island. Each stays hidden underwater, then leaps
// out in a clean arc — rising nose-up, diving nose-down — and slips smoothly back
// under the surface. Their ring sits just beyond the island's edge and widens as
// the island grows. Placed in the sea, so (unlike ducks/swans) they need no lake
// tile; the sea is always present.
function makeDolphins(islandGroup) {
  const group = new THREE.Group();
  group.userData.disposable = true;
  const SEA_Y = 0.28;         // waterline
  const LEAP_FRACTION = 0.5;  // share of the cycle spent leaping; rest is hidden underwater
  const N = 10;
  // ring hugging the coast: clear of the farthest tile (+ a tile's reach + margin)
  const base = (islandGroup ? islandOuterRadius(islandGroup) : 0) + TILE_SIZE + 1.6;
  const items = [];
  for (let i = 0; i < N; i++) {
    let model = getEffectModel('dolphin', 1.7);
    if (!model) model = makeDolphinFallback();
    // centre the model vertically so it pitches around its middle, not its tail
    const box = new THREE.Box3().setFromObject(model);
    model.position.y -= (box.min.y + box.max.y) / 2;
    const halfH = (box.max.y - box.min.y) / 2; // used to know when it clears the water
    model.rotation.y = DOLPHIN_MODEL_YAW;     // aim the nose along +X (fixes "sideways")
    const pitcher = new THREE.Group();        // tilts the nose up / down
    pitcher.add(model);
    const holder = new THREE.Group();         // rides the circle & aims along the path
    holder.add(pitcher);
    holder.visible = false;                   // underwater until its next leap
    group.add(holder);
    items.push({
      holder,
      pitcher,
      halfH,
      a: (i / N) * Math.PI * 2 + Math.random() * 0.4, // spread around the ring
      angSpeed: (0.12 + Math.random() * 0.06) * (i % 2 ? -1 : 1), // some swim the other way
      r: base + Math.random() * 2.6,       // just off the coast, a little scattered
      period: 3.2 + Math.random() * 2.4,   // seconds per full leap-and-hide cycle
      leap: Math.random(),                 // phase offset so they don't jump in sync
      height: 1.1 + Math.random() * 0.8,   // how high it leaps above the water
    });
  }
  group.userData.update = (t, dt) => {
    items.forEach((it) => {
      it.a += it.angSpeed * dt;            // keep drifting around even while hidden
      it.leap += dt / it.period;
      const u = it.leap % 1;               // 0..1 progress through the cycle
      if (u < LEAP_FRACTION) {             // the leap
        const p = u / LEAP_FRACTION;       // 0..1 across the leap
        const arc = Math.sin(p * Math.PI); // 0 at the ends → 1 at the peak
        // start and end the arc BELOW the surface, so the dolphin rises out of the
        // water and dives back in smoothly instead of blinking out half-submerged
        const dip = it.halfH + 0.4;
        const y = SEA_Y - dip + arc * (it.height + dip);
        it.holder.position.set(Math.cos(it.a) * it.r, y, Math.sin(it.a) * it.r);
        // face the way it actually travels: nose leads the motion whichever way it
        // circles (the ±sign flips for the dolphins swimming the other direction)
        it.holder.rotation.y = -it.a - Math.sign(it.angSpeed) * Math.PI / 2;
        it.pitcher.rotation.z = Math.cos(p * Math.PI) * 1.1; // nose up rising, down diving
        // only draw it once its body has broken the surface (hidden by the sea below)
        it.holder.visible = (y + it.halfH) > SEA_Y;
      } else {
        it.holder.visible = false;         // fully under the surface — nothing to see
      }
    });
  };
  return group;
}

// Foam along the island's actual coastline. For every tile, each of its six hex
// edges that faces open water (i.e. has no neighbouring tile on that side) gets a
// foam strip laid along that edge. So the foam traces the island's real outline —
// following the free edges of the boundary hexagons — instead of a plain circle.
// Rebuilt as the island grows so it always matches the current shape.
function makeWaves(islandGroup) {
  const group = new THREE.Group();
  group.userData.disposable = true;
  const SEA_Y = 0.30;
  // hex geometry: adjacent tiles sit A apart; a shared edge lies at the apothem
  // (half of A), is TILE_SIZE long, and runs perpendicular to the line to that neighbour.
  const A = TILE_SIZE * Math.sqrt(3);        // centre-to-centre of adjacent tiles
  const APOTHEM = A / 2;                      // centre-to-edge distance
  const NEIGHBOURS = [                        // the 6 world offsets to adjacent tiles
    [A, 0], [A / 2, -TILE_SIZE * 1.5], [-A / 2, -TILE_SIZE * 1.5],
    [-A, 0], [-A / 2, TILE_SIZE * 1.5], [A / 2, TILE_SIZE * 1.5],
  ];
  // a flat foam strip with rounded ends (a "stadium" shape), laid in the XZ plane
  // with its length along local X so the same edge-alignment rotation still applies
  const DEPTH = 0.55, RAD = DEPTH / 2, LEN = TILE_SIZE;
  const hw = Math.max(0.01, LEN / 2 - RAD);
  const shape = new THREE.Shape();
  shape.moveTo(-hw, -RAD);
  shape.lineTo(hw, -RAD);
  shape.absarc(hw, 0, RAD, -Math.PI / 2, Math.PI / 2, false);   // rounded right end
  shape.lineTo(-hw, RAD);
  shape.absarc(-hw, 0, RAD, Math.PI / 2, Math.PI * 1.5, false); // rounded left end
  const foamGeo = new THREE.ShapeGeometry(shape, 16);
  foamGeo.rotateX(-Math.PI / 2); // lay it flat: length stays along X, depth → Z

  const centres = [];
  islandGroup.children.forEach((c) => { if (c.userData.tileId) centres.push([c.position.x, c.position.z]); });
  const hasTileAt = (x, z) => centres.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < TILE_SIZE);
  const foams = [];
  centres.forEach(([cx, cz]) => {
    NEIGHBOURS.forEach(([ox, oz]) => {
      if (hasTileAt(cx + ox, cz + oz)) return; // neighbour present → inner edge, no foam
      const d = Math.hypot(ox, oz);
      const ux = ox / d, uz = oz / d;          // outward direction of this coast edge
      const strip = new THREE.Mesh(
        foamGeo,
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, fog: false }),
      );
      // sit at the edge midpoint, nudged just past the shore into the water
      strip.position.set(cx + ux * (APOTHEM + 0.12), SEA_Y + 0.03, cz + uz * (APOTHEM + 0.12));
      strip.rotation.y = Math.atan2(-ux, -uz); // lay the strip's length along the edge
      group.add(strip);
      foams.push({ strip, phase: Math.random() * Math.PI * 2 });
    });
  });
  group.userData.update = (t) => {
    foams.forEach((f) => { f.strip.material.opacity = 0.34 + 0.2 * Math.sin(t * 1.8 + f.phase); });
  };
  return group;
}

// Simple boat used if a boat model fails to load: a hull and a triangular sail,
// built facing +X like the other effect models.
function makeBoatFallback() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.22, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.8 })
  );
  hull.position.y = 0.11; g.add(hull);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0x6d543f }));
  mast.position.set(0, 0.55, 0); g.add(mast);
  const sail = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 3), new THREE.MeshStandardMaterial({ color: 0xf3ede0, side: THREE.DoubleSide }));
  sail.position.set(0.02, 0.6, 0); sail.rotation.y = Math.PI / 2; g.add(sail);
  return g;
}

// Per-boat heading correction so each model's bow points the right way. Positive =
// counter-clockwise (seen from above), negative = clockwise. Tweak per boat if one
// still sails sideways or stern-first.
const BOAT_MODEL_YAW = {
  boat_1: Math.PI,        // 180°
  boat_2: Math.PI / 2,    // 90° counter-clockwise
  boat_3: -Math.PI / 2,   // 90° clockwise
};

// One chosen boat sailing slowly around the island in the open sea. `boatKey` picks
// the model (boat_1/2/3). It's big and rides a ring well beyond the coast that
// widens as the island grows. Driven by the exclusive `active_boat` setting, so it's
// built directly by the scene (not through the additive-effects registry).
export function makeBoat(islandGroup, boatKey) {
  const modelKey = { boat_1: 'boat1', boat_2: 'boat2', boat_3: 'boat3' }[boatKey] || 'boat1';
  const group = new THREE.Group();
  group.userData.disposable = true;
  const SEA_Y = 0.28;
  const r = (islandGroup ? islandOuterRadius(islandGroup) : 0) + TILE_SIZE + 5.0; // big gap from the coast
  let model = getEffectModel(modelKey, 3.8); // clearly bigger than the dolphins
  if (!model) model = makeBoatFallback();
  model.rotation.y = BOAT_MODEL_YAW[boatKey] ?? 0;
  const holder = new THREE.Group();
  holder.add(model);
  group.add(holder);
  const s = { a: Math.random() * Math.PI * 2, angSpeed: 0.04, phase: Math.random() * Math.PI * 2, r, bob: 0.12 };
  group.userData.update = (t, dt) => {
    s.a += s.angSpeed * dt;
    const y = SEA_Y - 0.15 + Math.sin(t * 0.8 + s.phase) * s.bob;
    holder.position.set(Math.cos(s.a) * s.r, y, Math.sin(s.a) * s.r);
    holder.rotation.y = -s.a - Math.PI / 2;                 // face along the course
    holder.rotation.z = Math.sin(t * 1.0 + s.phase) * 0.035; // gentle roll on the swell
  };
  return group;
}

// A corked bottle bobbing in the sea, with a rolled note inside. It carries an
// invisible sphere so it's an easy tap target on a phone; the click handler in the
// scene opens the note editor. Placed just off the coast; free, in no pack.
// Simple corked bottle used if the Wine bottle model fails to load.
function makeBottleFallback() {
  const bottle = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: 0x8fd0c0, roughness: 0.12, transparent: true, opacity: 0.55 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.52, 16), glass);
  body.rotation.z = Math.PI / 2; bottle.add(body);
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, 0.14, 16), glass);
  shoulder.rotation.z = Math.PI / 2; shoulder.position.x = 0.33; bottle.add(shoulder);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 12), glass);
  neck.rotation.z = Math.PI / 2; neck.position.x = 0.46; bottle.add(neck);
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 12), new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.9 }));
  cork.rotation.z = Math.PI / 2; cork.position.x = 0.56; bottle.add(cork);
  return bottle;
}

function makeBottle(islandGroup) {
  const group = new THREE.Group();
  group.userData.disposable = true;
  group.userData.bottle = true; // marks it as the clickable message bottle
  const SEA_Y = 0.28;
  const R = (islandGroup ? islandOuterRadius(islandGroup) : 0) + TILE_SIZE * 0.9 + 1.0;
  const angle = 2.2;
  const bottle = new THREE.Group();
  const model = getEffectModel('winebottle', 1.2); // the wine bottle Даша added
  bottle.add(model || makeBottleFallback());
  // invisible larger sphere = a forgiving tap target (still raycasts while unseen)
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  hit.position.y = 0.4;
  bottle.add(hit);
  group.add(bottle);
  group.position.set(Math.cos(angle) * R, SEA_Y, Math.sin(angle) * R);
  group.userData.update = (t) => {
    group.position.y = SEA_Y + Math.sin(t * 1.2) * 0.06; // bob on the waves
    bottle.rotation.z = Math.sin(t * 0.9) * 0.06;        // gentle rock
    bottle.rotation.y = Math.sin(t * 0.3) * 0.3;         // slowly turn on the water
  };
  return group;
}

// A small, always-running fireworks show: a few shells that stagger, burst into
// a glowing spray of coloured particles, fall under gravity and fade, then relaunch
// from a fresh random spot in the sky. Purely additive glow — looks best at night.
function makeFireworks() {
  const group = new THREE.Group();
  group.userData.disposable = true;

  const BURSTS = 3;      // how many shells can be in the air at once
  const P = 70;          // particles per burst
  const GRAVITY = 3.2;
  const COLORS = [0xff5b7f, 0xffd24d, 0x6be0ff, 0x8affa0, 0xc98cff, 0xff9a4d];
  const bursts = [];

  const tmpColor = new THREE.Color();
  for (let b = 0; b < BURSTS; b++) {
    const pos = new Float32Array(P * 3);
    const vel = new Float32Array(P * 3);
    const col = new Float32Array(P * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.6, sizeAttenuation: true, transparent: true, opacity: 0,
      depthWrite: false, fog: false, blending: THREE.AdditiveBlending, vertexColors: true,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    group.add(points);
    bursts.push({ geo, mat, pos, vel, col, age: 0, dur: 1.9, alive: false, next: b * 0.8 });
  }

  function ignite(burst, cx, cy, cz) {
    for (let i = 0; i < P; i++) {
      const u = Math.random() * 2 - 1;         // random direction on a sphere
      const th = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const spd = 3 + Math.random() * 3.2;
      burst.vel[i * 3] = Math.cos(th) * s * spd;
      burst.vel[i * 3 + 1] = u * spd;
      burst.vel[i * 3 + 2] = Math.sin(th) * s * spd;
      burst.pos[i * 3] = cx; burst.pos[i * 3 + 1] = cy; burst.pos[i * 3 + 2] = cz;
      // each spark its own colour → a multicoloured burst
      tmpColor.setHex(COLORS[Math.floor(Math.random() * COLORS.length)]);
      burst.col[i * 3] = tmpColor.r; burst.col[i * 3 + 1] = tmpColor.g; burst.col[i * 3 + 2] = tmpColor.b;
    }
    burst.age = 0;
    burst.alive = true;
    burst.geo.attributes.position.needsUpdate = true;
    burst.geo.attributes.color.needsUpdate = true;
  }

  group.userData.update = (t, dt) => {
    bursts.forEach((burst) => {
      if (!burst.alive) {
        if (t >= burst.next) {
          const a = Math.random() * Math.PI * 2;
          const r = 6 + Math.random() * 12;
          ignite(burst, Math.cos(a) * r, 12 + Math.random() * 6, Math.sin(a) * r);
        }
        return;
      }
      burst.age += dt;
      const f = burst.age / burst.dur;
      const p = burst.pos, v = burst.vel;
      for (let i = 0; i < P; i++) {
        v[i * 3 + 1] -= GRAVITY * dt;
        p[i * 3] += v[i * 3] * dt;
        p[i * 3 + 1] += v[i * 3 + 1] * dt;
        p[i * 3 + 2] += v[i * 3 + 2] * dt;
      }
      burst.geo.attributes.position.needsUpdate = true;
      burst.mat.opacity = Math.max(0, 1 - f);
      if (burst.age >= burst.dur) {
        burst.alive = false;
        burst.mat.opacity = 0;
        burst.next = t + 0.5 + Math.random() * 1.6; // brief pause before the next shell
      }
    });
  };

  return group;
}

// A gentle stream of little hearts rising over the island, swaying and fading —
// the romantic centrepiece of the "Для двоих" pack.
export function makeHeartGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.5);
  s.bezierCurveTo(0, 0.8, -0.5, 1.0, -0.75, 0.5);
  s.bezierCurveTo(-1.1, -0.1, -0.2, -0.5, 0, -0.9);
  s.bezierCurveTo(0.2, -0.5, 1.1, -0.1, 0.75, 0.5);
  s.bezierCurveTo(0.5, 1.0, 0, 0.8, 0, 0.5);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.3, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, steps: 1,
  });
  geo.center();
  return geo;
}

function makeHearts() {
  const group = new THREE.Group();
  group.userData.disposable = true;
  const geo = makeHeartGeometry();
  const COLORS = [0xff5f8a, 0xff86a8, 0xe8506b, 0xff9ec2];
  const N = 12;
  const hearts = [];
  for (let i = 0; i < N; i++) {
    const col = COLORS[i % COLORS.length];
    const mat = new THREE.MeshStandardMaterial({
      color: col, roughness: 0.5, metalness: 0.0, transparent: true, opacity: 0,
      emissive: col, emissiveIntensity: 0.18,
    });
    const m = new THREE.Mesh(geo, mat);
    m.scale.setScalar(0.45 + Math.random() * 0.4);
    m.frustumCulled = false;
    group.add(m);
    hearts.push({
      m, mat,
      x: (Math.random() - 0.5) * 24,
      z: (Math.random() - 0.5) * 24,
      y: Math.random() * 12,
      speed: 0.7 + Math.random() * 0.7,
      sway: 0.6 + Math.random() * 0.9,
      phase: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.5,
      top: 13 + Math.random() * 3,
    });
  }
  group.userData.update = (t, dt) => {
    hearts.forEach((h) => {
      h.y += h.speed * dt;
      h.m.position.set(h.x + Math.sin(t * 0.8 + h.phase) * h.sway, h.y, h.z);
      h.m.rotation.y = t * h.spin;
      const fadeOut = Math.max(0, 1 - Math.max(0, h.y - (h.top - 3)) / 3);
      h.mat.opacity = 0.9 * Math.min(1, h.y / 2) * fadeOut; // fade in low, out near the top
      if (h.y > h.top) {
        h.y = -0.5;
        h.x = (Math.random() - 0.5) * 24;
        h.z = (Math.random() - 0.5) * 24;
      }
    });
  };
  return group;
}

// A little wooden sign on the home tile showing the couple's island name.
// The text is drawn to a canvas (so Cyrillic works) and used as a texture.
function makeNamePlaqueTexture(name) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7a4a28'; ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = '#a9743f'; ctx.fillRect(14, 14, 484, 228);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffddc4';
  ctx.font = '30px "Segoe UI", Arial, sans-serif';
  ctx.fillText('♥', 256, 58); // ♥
  let fs = 78;
  do { fs -= 4; ctx.font = `bold ${fs}px "Segoe UI", Arial, sans-serif`; } while (ctx.measureText(name).width > 452 && fs > 22);
  ctx.fillStyle = '#fff6e8';
  ctx.fillText(name, 256, 150);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function makePlaque(name) {
  const label = (name && name.trim()) ? name.trim() : 'Наш остров';
  const group = new THREE.Group();
  group.userData.disposable = true;

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a4a28, roughness: 0.85 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), woodMat);
  post.position.set(0, 0.6 + 0.5, 0);
  post.castShadow = true;
  group.add(post);

  const boardMat = new THREE.MeshStandardMaterial({ map: makeNamePlaqueTexture(label), roughness: 0.8 });
  // text texture on the front (+z) and back (-z) faces, plain wood on the edges
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.62, 0.07), [
    woodMat, woodMat, woodMat, woodMat, boardMat, boardMat,
  ]);
  board.position.set(0, 0.6 + 1.15, 0);
  board.castShadow = true;
  group.add(board);

  // stand it on the home tile, to the front-left of the house
  group.position.set(-1.05, 0, 0.85);
  group.rotation.y = 0.55;
  return group;
}

// key → builder(ctx). ctx.islandGroup lets lake-bound effects find the lake tile.
export const EFFECT_BUILDERS = {
  atmo_rain: () => fallingField({ count: 600, color: 0xcfeaff, size: 0.2, speed: 14, sway: 0.5, opacity: 0.75 }),
  atmo_snow: () => fallingField({ count: 400, color: 0xffffff, size: 0.32, speed: 2.2, sway: 1.2, opacity: 0.95 }),
  atmo_leaves: () => fallingField({ count: 160, color: 0xd98a3a, size: 0.44, speed: 1.8, sway: 2.0, opacity: 1.0 }),
  atmo_petals: () => fallingField({ count: 200, color: 0xf6b8ce, size: 0.36, speed: 1.6, sway: 2.2, opacity: 1.0 }),
  atmo_stars: () => makeConstellationStars(),
  atmo_meteors: () => makeMeteors(),
  atmo_aurora: () => makeAurora(),
  atmo_rainbow: () => makeRainbow(),
  atmo_clouds: () => makeClouds(),
  atmo_balloons: () => makeBalloons(),
  atmo_fireworks: () => makeFireworks(),
  atmo_hearts: () => makeHearts(),
  life_plaque: (ctx) => makePlaque(ctx.islandName),
  animal_butterflies: () => makeButterflies(),
  animal_ducks: (ctx) => makeWaterBirds('duck', ctx.islandGroup),
  animal_swans: (ctx) => makeWaterBirds('swan', ctx.islandGroup),
  animal_dolphins: (ctx) => makeDolphins(ctx.islandGroup),
  atmo_waves: (ctx) => makeWaves(ctx.islandGroup),
  life_bottle: (ctx) => makeBottle(ctx.islandGroup),
};

// Frees geometries/materials of a disposable effect object before removal.
export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { m.map?.dispose(); m.alphaMap?.dispose(); m.dispose(); });
    }
  });
}
