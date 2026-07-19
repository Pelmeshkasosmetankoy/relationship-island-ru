import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildTile, initTextures } from './tileBuilders';
import { preloadModels, preloadEffectModels, getFigureModel, getDecorModel } from './modelLoader';
import { SPIRAL, HEX_DIRS, hexToPos, TILE_SIZE } from './hexMath';
import { plotKey, DECOR_BY_KEY } from '../lib/decor';
import { SKY_PRESETS, PALETTE_TINTS, SEA_PRESETS, makeStars, makeSea, makeBirds, makeBoat, disposeObject, makeHeartGeometry, EFFECT_BUILDERS } from './upgradeEffects';

const ISLAND_ARRIVAL_ANIMATION = {
  enabled: true,
  duration: 1.35,
  riseFrom: -1.15,
  gatherDuration: 1.05,
};

function easeOutBackSoft(t) {
  const c1 = 1.25;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// Builds the renderer, camera, lights and controls and starts the render loop.
// Also exposes applyUpgrades() on sceneRef so React can drive the shop upgrades.
function createScene(container, onTileClick, onBottleClick, sceneRef) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_PRESETS.sky_day.bg);
  scene.fog = new THREE.Fog(SKY_PRESETS.sky_day.fog, 30, 70);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(10, 12, 14);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // cap for phone perf
  renderer.shadowMap.enabled = true;
  // Солнце и тайлы статичны, поэтому не пересчитываем карту теней каждый кадр —
  // обновляем только когда геометрия двигается (появление/сбор тайлов). При
  // вращении камеры тени не меняются → пропускаем целый проход отрисовки.
  renderer.shadowMap.autoUpdate = false;
  renderer.localClippingEnabled = true; // per-tile hexagon clipping of models
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 6;
  controls.maxDistance = 40;
  controls.maxPolarAngle = Math.PI * 0.47;

  const hemi = new THREE.HemisphereLight(0xffffff, 0x9fae7f, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3d6, 0.9);
  sun.position.set(12, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(512, 512);
  sun.shadow.camera.left = -25;
  sun.shadow.camera.right = 25;
  sun.shadow.camera.top = 25;
  sun.shadow.camera.bottom = -25;
  scene.add(sun);

  const islandGroup = new THREE.Group();
  scene.add(islandGroup);

  initTextures();

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function setMouseFromEvent(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const cx = e.clientX != null ? e.clientX : (e.changedTouches?.[0]?.clientX ?? 0);
    const cy = e.clientY != null ? e.clientY : (e.changedTouches?.[0]?.clientY ?? 0);
    mouse.x = ((cx - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((cy - rect.top) / rect.height) * 2 + 1;
  }

  function handleClick(e) {
    // на вкладке «Предметы» декором управляют pointer-обработчики ниже
    if (decorRT.mode === 'items') return;
    setMouseFromEvent(e);
    raycaster.setFromCamera(mouse, camera);
    if (decorRT.mode === 'plots') { handlePlotsClick(); return; }
    // the message bottle floats in the sea (not part of the island); if it's tapped,
    // open its note editor instead of hit-testing the tiles
    const bottle = dynamic.effects.get('life_bottle');
    if (bottle && bottle.visible && onBottleClick) {
      if (raycaster.intersectObject(bottle, true).length) { onBottleClick(); return; }
    }
    const hits = raycaster.intersectObjects(islandGroup.children, true);
    if (hits.length) {
      let obj = hits[0].object;
      while (obj && !obj.userData.tileId) obj = obj.parent;
      if (obj && obj.userData.tileId && obj.userData.tileId !== 'home' && !obj.userData.decorable) {
        onTileClick(obj.userData.tileId);
      }
    }
  }
  renderer.domElement.addEventListener('click', handleClick);

  function handleResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', handleResize);

  // ============================================================
  //  ДЕКОР: травяные площадки + расставляемые предметы
  // ============================================================
  const BASE_TOP = 0.6; // верх шестиугольной базы тайла
  const plotsGroup = new THREE.Group(); scene.add(plotsGroup);
  const decorGroup = new THREE.Group(); scene.add(decorGroup);
  const markersGroup = new THREE.Group(); scene.add(markersGroup);
  const renderedPlots = new Map(); // "q,r" -> tile group
  const renderedDecor = new Map(); // id -> { group, key, x, z, rot }
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BASE_TOP);
  const gp = new THREE.Vector3();
  const decorRT = {
    mode: null, placeKey: null, selectedId: null, eventCount: 0, plots: [],
    cb: {}, dragging: false, lastValid: false, dragTarget: null, plotColor: '',
  };
  let ghost = null;
  const selectionRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.06, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd479 })
  );
  selectionRing.rotation.x = Math.PI / 2;
  selectionRing.visible = false;
  scene.add(selectionRing);

  // клетки дома+событий с ОБХОДОМ площадок (события не занимают клетку площадки)
  function islandEventCells() {
    const plotSet = new Set(decorRT.plots.map((p) => plotKey(p.q, p.r)));
    const cells = [SPIRAL[0]]; // дом (0,0)
    for (let i = 1; i < SPIRAL.length && cells.length <= decorRT.eventCount; i++) {
      const c = SPIRAL[i];
      if (plotSet.has(plotKey(c.q, c.r))) continue;
      cells.push(c);
    }
    return cells; // дом + до eventCount событий
  }
  function occupiedKeys() {
    const set = new Set();
    islandEventCells().forEach((c) => set.add(plotKey(c.q, c.r)));
    decorRT.plots.forEach((p) => set.add(plotKey(p.q, p.r)));
    return set;
  }
  function freeAdjacentCells() {
    const occ = occupiedKeys();
    const eventCells = islandEventCells();
    const out = new Map();
    for (const cell of [...eventCells, ...decorRT.plots]) {
      for (const d of HEX_DIRS) {
        const nq = cell.q + d.q, nr = cell.r + d.r, k = plotKey(nq, nr);
        if (!occ.has(k)) out.set(k, { q: nq, r: nr });
      }
    }
    return [...out.values()];
  }
  function clearMarkers() {
    for (const m of [...markersGroup.children]) { markersGroup.remove(m); disposeObject(m); }
  }
  function refreshMarkers() {
    clearMarkers();
    if (decorRT.mode !== 'plots') return;
    for (const c of freeAdjacentCells()) {
      const { x, z } = hexToPos(c.q, c.r);
      const mk = new THREE.Mesh(
        new THREE.CylinderGeometry(TILE_SIZE * 0.82, TILE_SIZE * 0.82, 0.08, 6),
        new THREE.MeshBasicMaterial({ color: 0x6ad07a, transparent: true, opacity: 0.34 })
      );
      mk.position.set(x, BASE_TOP + 0.05, z);
      mk.userData.cell = c;
      mk.userData.marker = true;
      markersGroup.add(mk);
    }
  }

  // перекрасить верх/бока травяной площадки в выбранный цвет
  const _pc = new THREE.Color();
  function colorPlot(g, hex) {
    const base = g.children.find((c) => Array.isArray(c.material));
    if (!base) return;
    _pc.set(hex);
    const side = _pc.clone().multiplyScalar(0.5);
    base.material[1].color.copy(_pc);
    base.material[0].color.copy(side);
    base.material[2].color.copy(side);
    base.userData.tileBaseColors = [side.getHex(), _pc.getHex(), side.getHex()];
  }
  function setPlotColor(hex) {
    decorRT.plotColor = hex || '';
    if (hex) renderedPlots.forEach((g) => colorPlot(g, hex));
    renderer.shadowMap.needsUpdate = true;
  }

  function syncPlots(plots) {
    decorRT.plots = plots || [];
    const want = new Map((plots || []).map((p) => [plotKey(p.q, p.r), p]));
    for (const [k, mesh] of [...renderedPlots]) {
      if (!want.has(k)) { plotsGroup.remove(mesh); disposeObject(mesh); renderedPlots.delete(k); }
    }
    for (const [k, p] of want) {
      if (!renderedPlots.has(k)) {
        const t = buildTile('plot:' + k, 'grass', p.q, p.r);
        if (decorRT.plotColor) colorPlot(t, decorRT.plotColor);
        plotsGroup.add(t);
        renderedPlots.set(k, t);
      }
    }
    renderer.shadowMap.needsUpdate = true;
    refreshMarkers();
  }

  async function syncDecor(decor) {
    const want = new Map((decor || []).map((d) => [d.id, d]));
    for (const [id, info] of [...renderedDecor]) {
      if (!want.has(id)) {
        decorGroup.remove(info.group); disposeObject(info.group); renderedDecor.delete(id);
        if (decorRT.selectedId === id) selectDecor(null);
      }
    }
    for (const d of decor || []) {
      const existing = renderedDecor.get(d.id);
      if (existing) {
        existing.group.position.set(d.x, BASE_TOP, d.z);
        existing.group.rotation.y = d.rot || 0;
        existing.x = d.x; existing.z = d.z; existing.rot = d.rot || 0;
      } else {
        const item = DECOR_BY_KEY[d.key];
        if (!item) continue;
        const holder = new THREE.Group();
        holder.position.set(d.x, BASE_TOP, d.z);
        holder.rotation.y = d.rot || 0;
        holder.userData.decorId = d.id;
        decorGroup.add(holder);
        renderedDecor.set(d.id, { group: holder, key: d.key, x: d.x, z: d.z, rot: d.rot || 0 });
        const model = await getDecorModel(item.url, item.size || 1);
        if (model && renderedDecor.get(d.id)?.group === holder) holder.add(model);
      }
    }
    if (decorRT.selectedId) positionSelectionRing();
    renderer.shadowMap.needsUpdate = true;
  }

  function positionSelectionRing() {
    const info = renderedDecor.get(decorRT.selectedId);
    if (!info) { selectionRing.visible = false; return; }
    selectionRing.position.set(info.group.position.x, BASE_TOP + 0.06, info.group.position.z);
    selectionRing.visible = true;
  }
  function selectDecor(id) {
    decorRT.selectedId = id;
    if (id) positionSelectionRing(); else selectionRing.visible = false;
    decorRT.cb.onDecorSelect?.(id);
  }

  // проекция экранной точки на землю (y = BASE_TOP)
  function pointerGround(e) {
    setMouseFromEvent(e);
    raycaster.setFromCamera(mouse, camera);
    return raycaster.ray.intersectPlane(groundPlane, gp) ? gp.clone() : null;
  }
  // курсор над травяной площадкой? (валидное место)
  function overPlot(e) {
    setMouseFromEvent(e);
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObjects(plotsGroup.children, true)[0];
    return hit ? hit.point.clone() : null;
  }

  async function makeGhost(key) {
    clearGhost();
    const item = DECOR_BY_KEY[key];
    if (!item) return;
    const holder = new THREE.Group();
    holder.visible = false;
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(TILE_SIZE * 0.5, 24),
      new THREE.MeshBasicMaterial({ color: 0x6ad07a, transparent: true, opacity: 0.5, depthWrite: false })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.02;
    disc.userData.disc = true;
    holder.add(disc);
    scene.add(holder);
    ghost = holder;
    const model = await getDecorModel(item.url, item.size || 1);
    if (model && ghost === holder) {
      model.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.75; } });
      holder.add(model);
    }
  }
  function clearGhost() {
    if (ghost) { scene.remove(ghost); disposeObject(ghost); ghost = null; }
  }
  function setGhostValidity(valid) {
    decorRT.lastValid = valid;
    if (!ghost) return;
    const disc = ghost.children.find((c) => c.userData.disc);
    if (disc) disc.material.color.setHex(valid ? 0x6ad07a : 0xe06a6a);
  }

  // ---- pointer-обработчики (режим 'items': и постановка, и правка) ----
  // ближайший предмет к точке на земле в радиусе (палец «притягивается»)
  function nearestDecorId(point, radius) {
    let best = null, bestD = radius;
    for (const [id, info] of renderedDecor) {
      const d = Math.hypot(info.group.position.x - point.x, info.group.position.z - point.z);
      if (d <= bestD) { bestD = d; best = id; }
    }
    return best;
  }
  function onPointerDown(e) {
    if (decorRT.mode !== 'items') return;
    e.preventDefault();
    renderer.domElement.setPointerCapture?.(e.pointerId);
    const g = pointerGround(e);
    // большой радиус для правки; поменьше, когда в руке новый предмет (чтобы ставить рядом)
    const radius = decorRT.placeKey ? TILE_SIZE * 0.5 : TILE_SIZE * 0.9;
    const pick = g ? nearestDecorId(g, radius) : null;
    if (pick != null) {
      // тап рядом со стоящим предметом -> выбрать и тащить
      selectDecor(pick);
      decorRT.dragTarget = 'decor';
      decorRT.dragging = true;
      if (ghost) ghost.visible = false;
    } else if (decorRT.placeKey) {
      // ставим новый предмет (перетаскивание призрака)
      selectDecor(null);
      decorRT.dragTarget = 'ghost';
      decorRT.dragging = true;
      moveGhost(e);
    } else {
      selectDecor(null);
      decorRT.dragTarget = null;
    }
  }
  function onPointerMove(e) {
    if (!decorRT.dragging) return;
    if (decorRT.dragTarget === 'ghost') { moveGhost(e); return; }
    if (decorRT.dragTarget === 'decor' && decorRT.selectedId) {
      const g = pointerGround(e);
      const info = renderedDecor.get(decorRT.selectedId);
      if (g && info) {
        info.group.position.x = g.x; info.group.position.z = g.z;
        positionSelectionRing();
        selectionRing.material.color.setHex(overPlot(e) ? 0xffd479 : 0xe06a6a);
      }
    }
  }
  function onPointerUp(e) {
    if (!decorRT.dragging) return;
    decorRT.dragging = false;
    const target = decorRT.dragTarget;
    decorRT.dragTarget = null;
    if (target === 'ghost') {
      if (decorRT.lastValid && ghost) {
        decorRT.cb.onDecorPlace?.({ key: decorRT.placeKey, x: ghost.position.x, z: ghost.position.z, rot: ghost.rotation.y });
      }
    } else if (target === 'decor' && decorRT.selectedId) {
      const info = renderedDecor.get(decorRT.selectedId);
      const valid = overPlot(e);
      if (info && valid) {
        decorRT.cb.onDecorUpdate?.({ id: decorRT.selectedId, x: info.group.position.x, z: info.group.position.z, rot: info.group.rotation.y });
      } else if (info) {
        info.group.position.set(info.x, BASE_TOP, info.z); // вернуть на место, если бросили не на площадку
        positionSelectionRing();
      }
      selectionRing.material.color.setHex(0xffd479);
    }
  }
  function moveGhost(e) {
    if (!ghost) return;
    const g = pointerGround(e);
    if (g) { ghost.visible = true; ghost.position.x = g.x; ghost.position.z = g.z; ghost.position.y = BASE_TOP; }
    setGhostValidity(!!overPlot(e));
  }
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);

  // ---- клик в режиме площадок: добавить/убрать ----
  function handlePlotsClick() {
    // маркер свободной клетки -> добавить
    const mk = raycaster.intersectObjects(markersGroup.children, true)[0];
    if (mk) { const c = mk.object.userData.cell; decorRT.cb.onPlotAdd?.(c.q, c.r); return; }
    // существующая площадка -> убрать
    const ph = raycaster.intersectObjects(plotsGroup.children, true)[0];
    if (ph) {
      let obj = ph.object;
      while (obj && obj.userData.q == null) obj = obj.parent;
      if (obj && obj.userData.q != null) decorRT.cb.onPlotRemove?.(obj.userData.q, obj.userData.r);
    }
  }

  // ---- API режимов (вызывается из React) ----
  function setDecorMode(mode, placeKey) {
    decorRT.mode = mode || null;
    decorRT.placeKey = placeKey || null;
    decorRT.dragging = false;
    decorRT.dragTarget = null;
    controls.enabled = (mode == null || mode === 'plots'); // камера свободна только вне вкладки «Предметы»
    if (mode === 'items' && placeKey) makeGhost(placeKey); else clearGhost();
    if (mode == null || mode === 'plots') selectDecor(null);
    refreshMarkers();
  }
  function setDecorCallbacks(cb) { decorRT.cb = cb || {}; }
  function setEventCount(n) { decorRT.eventCount = n || 0; if (decorRT.mode === 'plots') refreshMarkers(); }
  function rotateSelected() {
    const info = renderedDecor.get(decorRT.selectedId);
    if (!info) return;
    info.group.rotation.y += Math.PI / 6;
    decorRT.cb.onDecorUpdate?.({ id: decorRT.selectedId, x: info.x, z: info.z, rot: info.group.rotation.y });
  }
  function removeSelected() {
    if (decorRT.selectedId) { decorRT.cb.onDecorRemove?.(decorRT.selectedId); }
  }

  // Holder for optional upgrade objects so the render loop can animate them.
  const dynamic = {
    stars: null,
    sea: null,
    birds: null,
    boat: null,
    boatKey: null,
    effects: new Map(),
    highlight: null,
    cameraMove: null,
    tileArrivals: new Map(),
    gather: null,
  };
  const tint = new THREE.Color();
  let coupleHeart = null; // heart mesh bobbing above the couple figures

  // Applies the full set of active upgrades. Idempotent: safe to call on every
  // change. `effects` is a Set of active additive effect keys (sea, birds,
  // atmosphere, animals — sounds are handled outside the scene).
  function applyUpgrades({ activeSky, activePalette, activeSea, effects, islandName, activeBoat }) {
    const sky = SKY_PRESETS[activeSky] || SKY_PRESETS.sky_day;
    scene.background.setHex(sky.bg);
    scene.fog.color.setHex(sky.fog);
    hemi.color.setHex(sky.hemiSky);
    hemi.groundColor.setHex(sky.hemiGround);
    hemi.intensity = sky.hemiInt;
    sun.color.setHex(sky.sunColor);
    sun.intensity = sky.sunInt;

    if (sky.stars && !dynamic.stars) {
      dynamic.stars = makeStars();
      scene.add(dynamic.stars);
    } else if (!sky.stars && dynamic.stars) {
      scene.remove(dynamic.stars);
      disposeObject(dynamic.stars);
      dynamic.stars = null;
    }

    const wantSea = effects.has('sea');
    if (wantSea && !dynamic.sea) {
      dynamic.sea = makeSea(activeSea);
      scene.add(dynamic.sea);
    } else if (!wantSea && dynamic.sea) {
      scene.remove(dynamic.sea);
      disposeObject(dynamic.sea);
      dynamic.sea = null;
    }
    if (dynamic.sea) {
      dynamic.sea.userData.seaPreset = activeSea;
      dynamic.sea.material.color.setHex(SEA_PRESETS[activeSea] ?? SEA_PRESETS.sea_blue);
    }

    const wantBirds = effects.has('birds');
    if (wantBirds && !dynamic.birds) {
      dynamic.birds = makeBirds();
      scene.add(dynamic.birds);
    } else if (!wantBirds && dynamic.birds) {
      scene.remove(dynamic.birds);
      disposeObject(dynamic.birds);
      dynamic.birds = null;
    }

    // boat (Морской пак): an exclusive choice, not an additive effect. Rebuilt each
    // apply so it re-fits when the chosen model changes or the island grows.
    const wantBoat = activeBoat && activeBoat !== 'boat_none' ? activeBoat : null;
    if (dynamic.boat) { scene.remove(dynamic.boat); disposeObject(dynamic.boat); dynamic.boat = null; }
    if (wantBoat) {
      dynamic.boat = makeBoat(islandGroup, wantBoat);
      dynamic.boat.traverse((o) => { o.frustumCulled = false; });
      scene.add(dynamic.boat);
    }
    dynamic.boatKey = wantBoat;

    // generic atmosphere & animal effects, driven by the EFFECT_BUILDERS registry
    Object.keys(EFFECT_BUILDERS).forEach((key) => {
      const want = effects.has(key);
      const has = dynamic.effects.has(key);
      // ducks/swans are rebuilt each update so they populate every current pond;
      // sea effects (dolphins/waves/boats/bottle) are rebuilt so they hug and widen
      // with the island as it grows
      const seaRing = key === 'animal_dolphins' || key === 'atmo_waves' || key === 'life_bottle';
      const rebuild = key === 'animal_ducks' || key === 'animal_swans' || key === 'life_plaque' || seaRing;
      if (want && (!has || rebuild)) {
        if (has) {
          const old = dynamic.effects.get(key);
          scene.remove(old);
          disposeObject(old);
        }
        const obj = EFFECT_BUILDERS[key]({ islandGroup, islandName });
        obj.traverse((o) => { o.frustumCulled = false; }); // don't cull dynamic particles
        dynamic.effects.set(key, obj);
        scene.add(obj);
      } else if (!want && has) {
        const obj = dynamic.effects.get(key);
        scene.remove(obj);
        disposeObject(obj);
        dynamic.effects.delete(key);
      }
    });

    // land palette: re-tint every tile base from its stored original colours
    tint.setHex(PALETTE_TINTS[activePalette] ?? 0xffffff);
    islandGroup.traverse((o) => {
      const orig = o.userData.tileBaseColors;
      if (orig && Array.isArray(o.material)) {
        o.material.forEach((m, i) => { m.color.setHex(orig[i]).multiply(tint); });
      }
    });
  }

  const clock = new THREE.Clock();
  let prevT = 0;
  let frameId;
  let shadowWarmup = 90; // первые ~1.5 с рисуем тени каждый кадр (тайлы/модели догружаются)
  function animate() {
    frameId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    const dt = Math.min(t - prevT, 0.05);
    prevT = t;
    // тени пересчитываем только пока тайлы двигаются (появляются/собираются)
    if (shadowWarmup > 0) { renderer.shadowMap.needsUpdate = true; shadowWarmup--; }
    if (dynamic.tileArrivals.size || dynamic.gather) renderer.shadowMap.needsUpdate = true;
    islandGroup.children.forEach((g) => {
      if (g.userData.crystal) g.userData.crystal.rotation.y += 0.015;
    });
    if (dynamic.birds) dynamic.birds.rotation.y += 0.0035;
    if (dynamic.sea) {
      dynamic.sea.position.y = dynamic.sea.userData.baseY + Math.sin(t * 0.8) * 0.03;
      if (dynamic.sea.material.map) {
        dynamic.sea.material.map.offset.x = t * 0.006;
        dynamic.sea.material.map.offset.y = t * 0.004;
      }
    }
    dynamic.effects.forEach((obj) => { if (obj.userData.update) obj.userData.update(t, dt); });
    if (dynamic.boat?.userData.update) dynamic.boat.userData.update(t, dt);
    dynamic.tileArrivals.forEach((arrival, tile) => {
      const elapsed = Math.min((t - arrival.startedAt) / arrival.duration, 1);
      const eased = easeOutBackSoft(elapsed);
      const settle = Math.sin(elapsed * Math.PI);
      tile.position.y = arrival.baseY + arrival.riseFrom * (1 - eased);
      tile.scale.setScalar(0.86 + 0.14 * easeInOutSine(elapsed));
      tile.rotation.x = Math.sin(elapsed * Math.PI * 2.1) * 0.035 * (1 - elapsed);
      tile.rotation.z = Math.cos(elapsed * Math.PI * 1.8) * 0.045 * (1 - elapsed);
      tile.rotation.y = arrival.baseRotationY + settle * 0.045;
      if (elapsed >= 1) {
        tile.position.y = arrival.baseY;
        tile.scale.setScalar(1);
        tile.rotation.set(0, arrival.baseRotationY, 0);
        dynamic.tileArrivals.delete(tile);
      }
    });
    if (dynamic.gather) {
      const elapsed = Math.min((t - dynamic.gather.startedAt) / dynamic.gather.duration, 1);
      const wave = Math.sin(easeInOutSine(elapsed) * Math.PI);
      dynamic.gather.tiles.forEach(({ tile, baseX, baseZ, pullX, pullZ }) => {
        if (dynamic.tileArrivals.has(tile)) return;
        tile.position.x = baseX + pullX * wave;
        tile.position.z = baseZ + pullZ * wave;
      });
      if (elapsed >= 1) {
        dynamic.gather.tiles.forEach(({ tile, baseX, baseZ }) => {
          if (dynamic.tileArrivals.has(tile)) return;
          tile.position.x = baseX;
          tile.position.z = baseZ;
        });
        dynamic.gather = null;
      }
    }
    if (dynamic.highlight) dynamic.highlight.intensity = 2.5 + Math.sin(t * 2.6) * 0.45;
    if (coupleHeart) {
      coupleHeart.position.y = coupleHeart.userData.baseY + Math.sin(t * 2) * 0.06;
      coupleHeart.rotation.y = t * 0.8;
    }
    if (dynamic.cameraMove) {
      const elapsed = Math.min((t - dynamic.cameraMove.startedAt) / 0.9, 1);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      camera.position.lerpVectors(dynamic.cameraMove.fromCamera, dynamic.cameraMove.toCamera, eased);
      controls.target.lerpVectors(dynamic.cameraMove.fromTarget, dynamic.cameraMove.toTarget, eased);
      if (elapsed >= 1) dynamic.cameraMove = null;
    }
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  function highlightTile(tile) {
    if (dynamic.highlight) {
      dynamic.highlight.parent?.remove(dynamic.highlight);
      dynamic.highlight = null;
    }
    if (!tile) return;
    const light = new THREE.PointLight(0xffcf78, 2.5, 7, 1.6);
    light.position.set(0, 2.8, 0);
    tile.add(light);
    dynamic.highlight = light;

    const tilePosition = new THREE.Vector3();
    tile.getWorldPosition(tilePosition);
    const offset = camera.position.clone().sub(controls.target);
    if (offset.length() > 11) offset.setLength(11);
    if (offset.length() < 7) offset.setLength(7);
    dynamic.cameraMove = {
      startedAt: clock.getElapsedTime(),
      fromCamera: camera.position.clone(),
      toCamera: tilePosition.clone().add(offset),
      fromTarget: controls.target.clone(),
      toTarget: tilePosition.clone().setY(0.5),
    };
  }

  function playTileArrival(tile) {
    if (!ISLAND_ARRIVAL_ANIMATION.enabled || !tile) return;
    const now = clock.getElapsedTime();
    const baseY = tile.position.y;
    tile.position.y = baseY + ISLAND_ARRIVAL_ANIMATION.riseFrom;
    tile.scale.setScalar(0.86);
    dynamic.tileArrivals.set(tile, {
      startedAt: now,
      duration: ISLAND_ARRIVAL_ANIMATION.duration,
      riseFrom: ISLAND_ARRIVAL_ANIMATION.riseFrom,
      baseY,
      baseRotationY: tile.rotation.y,
    });

    const target = tile.position.clone();
    const tiles = islandGroup.children
      .filter((other) => other !== tile && other.userData.tileId)
      .map((other) => {
        const dx = target.x - other.position.x;
        const dz = target.z - other.position.z;
        const dist = Math.max(Math.sqrt(dx * dx + dz * dz), 0.001);
        const strength = Math.min(0.13, 0.055 + 0.035 / dist);
        return {
          tile: other,
          baseX: other.position.x,
          baseZ: other.position.z,
          pullX: (dx / dist) * strength,
          pullZ: (dz / dist) * strength,
        };
      });
    dynamic.gather = {
      startedAt: now + 0.12,
      duration: ISLAND_ARRIVAL_ANIMATION.gatherDuration,
      tiles,
    };
  }

  sceneRef.current = {
    scene, camera, renderer, controls, islandGroup, applyUpgrades, highlightTile, playTileArrival,
    setCoupleHeart: (h) => { coupleHeart = h; },
    syncPlots, syncDecor, setDecorMode, setDecorCallbacks, setEventCount, rotateSelected, removeSelected, setPlotColor,
  };

  return () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener('resize', handleResize);
    renderer.domElement.removeEventListener('click', handleClick);
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    renderer.domElement.removeEventListener('pointerup', onPointerUp);
    if (dynamic.stars) disposeObject(dynamic.stars);
    if (dynamic.sea) disposeObject(dynamic.sea);
    if (dynamic.birds) disposeObject(dynamic.birds);
    if (dynamic.boat) disposeObject(dynamic.boat);
    dynamic.effects.forEach((obj) => disposeObject(obj));
    dynamic.effects.clear();
    if (dynamic.highlight) dynamic.highlight.parent?.remove(dynamic.highlight);
    renderer.dispose();
    container.removeChild(renderer.domElement);
  };
}

export default function IslandScene({ events, onTileClick, onBottleClick, highlightedEventId = null, activeEffects = [], activeSky = 'sky_day', activePalette = 'palette_classic', activeSea = 'sea_blue', activeIslandName = '', activeBoy = 'boy_none', activeGirl = 'girl_none', activeBoat = 'boat_none', figureColors = {}, plots = [], decor = [], decorMode = null, decorPlaceKey = null, plotColor = '', onPlotAdd, onPlotRemove, onDecorPlace, onDecorUpdate, onDecorRemove, onDecorSelect }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const coupleRef = useRef(null); // the couple figures group on the home tile
  const renderedTiles = useRef(new Map()); // event id -> { group, type, index }
  const hasSyncedEvents = useRef(false);
  const [sceneError, setSceneError] = useState(null);
  const [ready, setReady] = useState(false);

  // one-time scene setup: build the empty scene, preload models, then place the
  // home tile. `ready` gates the tile-adding effect below until models are in.
  useEffect(() => {
    const container = containerRef.current;
    let cleanup = () => {};
    let cancelled = false;
    try {
      cleanup = createScene(container, onTileClick, onBottleClick, sceneRef);
    } catch (err) {
      console.error('Failed to initialize 3D scene:', err);
      setSceneError(err.message || 'Не удалось запустить 3D-сцену.');
      return () => {};
    }
    Promise.all([preloadModels(), preloadEffectModels()]).finally(() => {
      if (cancelled || !sceneRef.current) return;
      sceneRef.current.islandGroup.add(buildTile('home', 'home', 0, 0));
      setReady(true);
    });
    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reconcile the island's tiles with the events list. Pure additions just append
  // a tile (camera/animation preserved); any change to an existing tile's type or
  // position, or a deletion, rebuilds the affected tiles so edits and deletes show.
  useEffect(() => {
    const s = sceneRef.current;
    if (!s || !ready) return;
    const islandGroup = s.islandGroup;
    const rendered = renderedTiles.current;
    const desired = events.map((ev, i) => ({ id: ev.id, type: ev.type, index: i }));
    const desiredById = new Map(desired.map((d) => [d.id, d]));

    // if any already-rendered tile no longer matches (type or position changed, or
    // it was removed), drop all event tiles and rebuild — positions are index-based,
    // so a deletion shifts everything after it
    let needsRebuild = false;
    for (const [id, info] of rendered) {
      const d = desiredById.get(id);
      if (!d || d.type !== info.type || d.index !== info.index) { needsRebuild = true; break; }
    }
    if (needsRebuild) {
      for (const [, info] of rendered) islandGroup.remove(info.group);
      rendered.clear();
    }

    // клетки под события с ОБХОДОМ площадок, чтобы новый остров не «съедал» площадку
    const plotSet = new Set((plots || []).map((p) => plotKey(p.q, p.r)));
    const eventCells = [];
    for (let i = 1; i < SPIRAL.length && eventCells.length < events.length; i++) {
      const c = SPIRAL[i];
      if (plotSet.has(plotKey(c.q, c.r))) continue;
      eventCells.push(c);
    }

    const shouldAnimateNewTiles = hasSyncedEvents.current && !needsRebuild;
    desired.forEach((d) => {
      if (rendered.has(d.id)) return;
      const pos = eventCells[d.index] || SPIRAL[SPIRAL.length - 1];
      const tile = buildTile(d.id, d.type, pos.q, pos.r);
      islandGroup.add(tile);
      rendered.set(d.id, { group: tile, type: d.type, index: d.index });
      if (shouldAnimateNewTiles) s.playTileArrival(tile);
    });
    hasSyncedEvents.current = true;
  }, [events, ready, plots]);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s || !ready) return;
    s.highlightTile(highlightedEventId ? renderedTiles.current.get(highlightedEventId)?.group : null);
  }, [highlightedEventId, events, ready]);

  // apply shop upgrades whenever purchases, the active sky/palette, or the tiles
  // change (tiles matter because the palette must re-tint freshly added bases)
  useEffect(() => {
    const s = sceneRef.current;
    if (!s || !ready) return;
    s.applyUpgrades({
      activeSky,
      activePalette,
      activeSea,
      effects: new Set(activeEffects),
      islandName: activeIslandName,
      activeBoat,
    });
  }, [ready, activeEffects, activeSky, activePalette, activeSea, events, activeIslandName, activeBoat]);

  // couple figures (пак «Для двоих»): show the chosen "him"/"her" models on the
  // home tile. Nothing until an outfit is picked. Models load lazily on demand.
  useEffect(() => {
    const s = sceneRef.current;
    if (!s || !ready) return;
    let cancelled = false;
    if (coupleRef.current) {
      s.setCoupleHeart(null);
      s.scene.remove(coupleRef.current);
      disposeObject(coupleRef.current);
      coupleRef.current = null;
    }
    const boyKey = activeBoy && activeBoy !== 'boy_none' ? activeBoy : null;
    const girlKey = activeGirl && activeGirl !== 'girl_none' ? activeGirl : null;
    if (!boyKey && !girlKey) return;
    (async () => {
      const group = new THREE.Group();
      const y = 0.6; // top of the home hex base
      if (boyKey) {
        const m = await getFigureModel(boyKey, 0.95, figureColors.boy);
        // boy on the left, turned clockwise (from above) toward the girl
        if (m) { m.position.set(-0.35, y, 0.95); m.rotation.y = -0.1; group.add(m); }
      }
      if (girlKey) {
        const m = await getFigureModel(girlKey, 0.9, figureColors.girl);
        // girl authored facing backward → 180°, then turned counter-clockwise toward the boy
        if (m) { m.position.set(0.35, y, 0.95); m.rotation.y = Math.PI + 0.1; group.add(m); }
      }
      // a little heart bobbing above the pair (like the very first figures)
      const heart = new THREE.Mesh(
        makeHeartGeometry(),
        new THREE.MeshStandardMaterial({ color: 0xff5f8a, emissive: 0xff5f8a, emissiveIntensity: 0.3, roughness: 0.5 })
      );
      heart.scale.setScalar(0.18);
      heart.userData.baseY = y + 1.2;
      heart.position.set(0, heart.userData.baseY, 0.95);
      group.add(heart);
      if (cancelled) { disposeObject(group); return; }
      s.scene.add(group);
      coupleRef.current = group;
      s.setCoupleHeart(heart);
    })();
    return () => { cancelled = true; };
  }, [ready, activeBoy, activeGirl, figureColors.boy, figureColors.girl]);

  // ---- декор: пробрасываем данные, режим и колбэки в сцену ----
  useEffect(() => {
    const s = sceneRef.current;
    if (!s || !ready) return;
    s.setDecorCallbacks({ onPlotAdd, onPlotRemove, onDecorPlace, onDecorUpdate, onDecorRemove, onDecorSelect });
  }, [ready, onPlotAdd, onPlotRemove, onDecorPlace, onDecorUpdate, onDecorRemove, onDecorSelect]);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s || !ready) return;
    s.setEventCount(events.length);
  }, [ready, events]);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s || !ready) return;
    s.syncPlots(plots);
  }, [ready, plots]);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s || !ready) return;
    s.syncDecor(decor);
  }, [ready, decor]);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s || !ready) return;
    s.setDecorMode(decorMode, decorPlaceKey);
  }, [ready, decorMode, decorPlaceKey]);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s || !ready) return;
    s.setPlotColor(plotColor);
  }, [ready, plotColor, plots]);

  if (sceneError) {
    return (
      <div id="three-container" className="screen-center">
        <div className="card">
          <p className="eyebrow">Ошибка</p>
          <h1>Не получилось отрисовать остров</h1>
          <p className="sub">{sceneError}</p>
        </div>
      </div>
    );
  }

  return <div id="three-container" ref={containerRef} style={{ position: 'fixed', inset: 0 }} />;
}
