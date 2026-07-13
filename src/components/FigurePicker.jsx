import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { getFigureModel } from '../scene/modelLoader';
import { FIGURE_CHOICES } from '../lib/economy';
import { tr } from '../i18n';

const BOY = FIGURE_CHOICES.boy;
const GIRL = FIGURE_CHOICES.girl;
const DEFAULT_COLORS = {
  shirt: '#6b4fd8',
  pants: '#2f3148',
  face: '#ffb978',
  hair: '#3b2017',
};
const COLOR_PARTS = [
  { key: 'shirt', label: 'Кофта' },
  { key: 'pants', label: 'Брюки' },
  { key: 'face', label: 'Лицо' },
  { key: 'hair', label: 'Волосы' },
];

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function hexToHsv(hex) {
  const clean = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex.slice(1) : 'ffffff';
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

function hsvToHex({ h, s, v }) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return '#' + [r, g, b]
    .map((n) => Math.round((n + m) * 255).toString(16).padStart(2, '0'))
    .join('');
}

// A "fitting room": a live 3D preview of each figure you can spin with a finger,
// flipping through the outfits with arrows. "Him" and "Her" are separate.
export default function FigurePicker({ activeBoy, activeGirl, figureColors, onSelect, onColorsChange, onClose, locked }) {
  const [tab, setTab] = useState('boy');
  const list = tab === 'boy' ? BOY : GIRL;
  const active = tab === 'boy' ? activeBoy : activeGirl;
  const colors = { ...DEFAULT_COLORS, ...(figureColors?.[tab] || {}) };
  const [index, setIndex] = useState(() => Math.max(0, list.indexOf(active)));
  const [colorPart, setColorPart] = useState('shirt');
  const paletteRef = useRef(null);
  const hueRef = useRef(null);

  const mountRef = useRef(null);
  const api = useRef(null);
  const figureRef = useRef(null);
  const selectedHex = colors[colorPart] || DEFAULT_COLORS[colorPart];
  const selectedHsv = hexToHsv(selectedHex);
  const hueHex = hsvToHex({ h: selectedHsv.h, s: 1, v: 1 });

  // when switching Him/Her, jump to that side's currently-chosen outfit
  useEffect(() => {
    setIndex(Math.max(0, list.indexOf(active)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // one-time mini 3D scene setup
  useEffect(() => {
    const mount = mountRef.current;
    const w = mount.clientWidth || 300;
    const h = mount.clientHeight || 300;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
    camera.position.set(0, 0.65, 2.5);
    camera.lookAt(0, 0.55, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a9a, 1.15));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(2, 4, 3);
    scene.add(dir);
    const holder = new THREE.Group();
    scene.add(holder);

    let raf, dragging = false, lastX = 0, autoSpin = true;
    const px = (e) => (e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0));
    const onDown = (e) => { dragging = true; autoSpin = false; lastX = px(e); };
    const onMove = (e) => { if (!dragging) return; const x = px(e); holder.rotation.y += (x - lastX) * 0.012; lastX = x; };
    const onUp = () => { dragging = false; };
    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    const animate = () => { raf = requestAnimationFrame(animate); if (autoSpin) holder.rotation.y += 0.008; renderer.render(scene, camera); };
    animate();

    api.current = { holder, resetSpin: () => { autoSpin = true; } };

    return () => {
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  // load the shown figure whenever the outfit / side changes
  useEffect(() => {
    if (!api.current) return;
    let cancelled = false;
    const key = list[index];
    (async () => {
      const model = await getFigureModel(key, 1.15, colors);
      if (cancelled || !api.current) return;
      if (figureRef.current) { api.current.holder.remove(figureRef.current); figureRef.current = null; }
      if (model) {
        if (tab === 'girl') model.rotation.y = Math.PI; // girl model faces backward
        api.current.holder.add(model);
        figureRef.current = model;
      }
      api.current.holder.rotation.y = 0;
      api.current.resetSpin();
    })();
    return () => { cancelled = true; };
  }, [index, tab, list, colors.shirt, colors.pants, colors.face, colors.hair]);

  const prev = () => setIndex((i) => (i - 1 + list.length) % list.length);
  const next = () => setIndex((i) => (i + 1) % list.length);
  const chosen = active === list[index];
  const setPartColor = (hex) => onColorsChange?.(tab, { ...colors, [colorPart]: hex });
  const setFromPalette = (event) => {
    const rect = paletteRef.current?.getBoundingClientRect();
    if (!rect) return;
    const s = clamp01((event.clientX - rect.left) / rect.width);
    const v = 1 - clamp01((event.clientY - rect.top) / rect.height);
    setPartColor(hsvToHex({ h: selectedHsv.h, s, v }));
  };
  const setFromHue = (event) => {
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;
    const h = clamp01((event.clientX - rect.left) / rect.width) * 360;
    setPartColor(hsvToHex({ h, s: selectedHsv.s, v: selectedHsv.v }));
  };
  const captureAndRun = (fn) => (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    fn(event);
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal figure-picker">
        <h2>{tr('fp_title')}</h2>
        <div className="fp-tabs">
          <button className={`fp-tab ${tab === 'boy' ? 'active' : ''}`} onClick={() => setTab('boy')}>{tr('cat_boy')}</button>
          <button className={`fp-tab ${tab === 'girl' ? 'active' : ''}`} onClick={() => setTab('girl')}>{tr('cat_girl')}</button>
        </div>

        <div className="fp-stage">
          <button className="fp-arrow" onClick={prev} disabled={list.length <= 1} aria-label={tr('fp_prev')}>‹</button>
          <div className="fp-canvas" ref={mountRef} />
          <button className="fp-arrow" onClick={next} disabled={list.length <= 1} aria-label={tr('fp_next')}>›</button>
        </div>

        <div className="fp-caption">{tr('item_' + list[index] + '_name')} · {index + 1}/{list.length}</div>
        <div className="fp-hint">{tr('fp_hint')}</div>
        {locked && <div className="fp-premium">✨ {tr('premium_badge')}</div>}

        <div className="fp-color-tabs" aria-label="Цвета персонажа">
          {COLOR_PARTS.map((part) => (
            <button
              className={`fp-color-tab ${colorPart === part.key ? 'active' : ''}`}
              key={part.key}
              onClick={() => setColorPart(part.key)}
              type="button"
            >
              <span className="fp-color-dot" style={{ background: colors[part.key] }} />
              {part.label}
            </button>
          ))}
        </div>

        <div className="fp-palette-card">
          <div className="fp-palette-title">
            <span>Палитра · {COLOR_PARTS.find((part) => part.key === colorPart)?.label}</span>
            <span className="fp-palette-hex">{selectedHex.toUpperCase()}</span>
          </div>
          <div className="fp-palette-main">
            <div className="fp-palette-preview" style={{ background: selectedHex }} />
            <div
              className="fp-palette-field"
              ref={paletteRef}
              style={{ '--fp-hue': hueHex }}
              onPointerDown={captureAndRun(setFromPalette)}
              onPointerMove={(e) => { if (e.buttons) setFromPalette(e); }}
            >
              <span
                className="fp-palette-cursor"
                style={{ left: `${selectedHsv.s * 100}%`, top: `${(1 - selectedHsv.v) * 100}%` }}
              />
            </div>
          </div>
          <div
            className="fp-hue-slider"
            ref={hueRef}
            onPointerDown={captureAndRun(setFromHue)}
            onPointerMove={(e) => { if (e.buttons) setFromHue(e); }}
          >
            <span className="fp-hue-cursor" style={{ left: `${(selectedHsv.h / 360) * 100}%` }} />
          </div>
          <label className="fp-hex-input">
            <span>HEX</span>
            <input
              value={selectedHex.toUpperCase()}
              onChange={(e) => {
                const value = e.target.value.trim();
                if (/^#[0-9a-f]{6}$/i.test(value)) setPartColor(value);
              }}
            />
          </label>
        </div>

        <div className="modal-actions">
          <button className="btn" style={{ flex: 1 }} onClick={() => onSelect(tab, tab === 'boy' ? 'boy_none' : 'girl_none')}>
            {tr('fp_remove')}
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={chosen} onClick={() => onSelect(tab, list[index])}>
            {chosen ? tr('fp_selected') : tr('fp_select')}
          </button>
        </div>
        <button className="link-btn" style={{ marginTop: 10, display: 'block' }} onClick={onClose}>{tr('close')}</button>
      </div>
    </div>
  );
}
