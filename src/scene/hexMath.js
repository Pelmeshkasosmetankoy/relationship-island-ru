export const TILE_SIZE = 2.0;

export const HEX_DIRS = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

function hexRing(radius) {
  const results = [];
  let hex = { q: HEX_DIRS[4].q * radius, r: HEX_DIRS[4].r * radius };
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      results.push({ q: hex.q, r: hex.r });
      hex = { q: hex.q + HEX_DIRS[i].q, r: hex.r + HEX_DIRS[i].r };
    }
  }
  return results;
}

export function hexSpiral(maxRing) {
  let out = [{ q: 0, r: 0 }];
  for (let k = 1; k <= maxRing; k++) out = out.concat(hexRing(k));
  return out;
}

export function hexToPos(q, r) {
  const x = TILE_SIZE * Math.sqrt(3) * (q + r / 2);
  const z = TILE_SIZE * 1.5 * r;
  return { x, z };
}

// Enough rings for well over a hundred events; grows the spiral if ever exceeded.
export const SPIRAL = hexSpiral(8);
