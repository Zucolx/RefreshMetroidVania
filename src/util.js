// Utilidades matemáticas y de azar. Sin dependencias del DOM (se usa también en Node).

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
export const approach = (v, target, delta) =>
  v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const angTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeOut = (t) => 1 - (1 - t) * (1 - t);
export const TAU = Math.PI * 2;

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
export function circleRect(cx, cy, r, b) {
  const nx = clamp(cx, b.x, b.x + b.w);
  const ny = clamp(cy, b.y, b.y + b.h);
  return (cx - nx) ** 2 + (cy - ny) ** 2 <= r * r;
}
export function pointInRect(x, y, b) {
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

// ---- azar -------------------------------------------------------------
export const rnd = () => Math.random();
export const rrange = (a, b) => a + Math.random() * (b - a);
export const rint = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const chance = (p) => Math.random() < p;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** PRNG determinista (mulberry32) para niveles. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + f() * (hi - lo);
  f.int = (lo, hi) => Math.floor(lo + f() * (hi - lo + 1));
  f.chance = (p) => f() < p;
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}

/** Hash determinista en [0,1) para variaciones de tiles/decorado. */
export function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Vector unitario de 8 direcciones más cercano a (dx,dy). */
export function snap8(dx, dy) {
  if (!dx && !dy) return { x: 0, y: 0 };
  const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return { x: Math.round(Math.cos(a) * 1000) / 1000, y: Math.round(Math.sin(a) * 1000) / 1000 };
}

export function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}
export function getPath(o, path) {
  return path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
}
export function setPath(o, path, v) {
  const ks = path.split('.');
  const last = ks.pop();
  const t = ks.reduce((a, k) => a[k], o);
  t[last] = v;
}
export function fmtTime(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}
