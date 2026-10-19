// Cuerpos y colisión AABB contra tiles + sólidos dinámicos.
import { TILE } from './config.js';
import { T } from './world.js';

export class Body {
  constructor(x = 0, y = 0, w = 24, h = 24) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.px = x; this.py = y; // posición previa (interpolación de render)
    this.onGround = false;
    this.ride = null;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get bottom() { return this.y + this.h; }
  setCenter(cx, cy) { this.x = cx - this.w / 2; this.y = cy - this.h / 2; }
  setFeet(cx, by) { this.x = cx - this.w / 2; this.y = by - this.h; }
  snap() { this.px = this.x; this.py = this.y; }
  rect() { return this; }
}

const EPS = 0.001;

/**
 * Mueve el cuerpo con colisión.
 * opts: { drop: bool (atraviesa plataformas), noWorld: bool, gravity: número }
 * Devuelve { l, r, u, d } con las colisiones producidas.
 */
export function moveBody(world, b, dt, opts = {}) {
  const res = { l: false, r: false, u: false, d: false };
  if (opts.noWorld) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    return res;
  }
  const dx = b.vx * dt, dy = b.vy * dt;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 10));
  const sx = dx / steps, sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    if (sx !== 0) {
      b.x += sx;
      resolveX(world, b, sx, res);
    }
    if (sy !== 0) {
      const prevBottom = b.y + b.h;
      b.y += sy;
      resolveY(world, b, sy, prevBottom, opts.drop, res);
    }
  }
  return res;
}

function resolveX(world, b, sx, res) {
  const x0 = Math.floor(b.x / TILE), x1 = Math.floor((b.x + b.w - EPS) / TILE);
  const y0 = Math.floor(b.y / TILE), y1 = Math.floor((b.y + b.h - EPS) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (world.get(tx, ty) === T.SOLID) {
        if (sx > 0) { b.x = tx * TILE - b.w; res.r = true; }
        else { b.x = (tx + 1) * TILE; res.l = true; }
        b.vx = 0;
        return;
      }
    }
  }
  for (const d of world.dyn) {
    if (d.oneWay || d.off) continue;
    if (b.x < d.x + d.w && b.x + b.w > d.x && b.y < d.y + d.h && b.y + b.h > d.y) {
      if (sx > 0) { b.x = d.x - b.w; res.r = true; }
      else { b.x = d.x + d.w; res.l = true; }
      b.vx = 0;
      return;
    }
  }
}

function resolveY(world, b, sy, prevBottom, drop, res) {
  const x0 = Math.floor(b.x / TILE), x1 = Math.floor((b.x + b.w - EPS) / TILE);
  const y0 = Math.floor(b.y / TILE), y1 = Math.floor((b.y + b.h - EPS) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = world.get(tx, ty);
      if (t === T.SOLID) {
        if (sy > 0) { b.y = ty * TILE - b.h; res.d = true; b.ride = null; }
        else { b.y = (ty + 1) * TILE; res.u = true; }
        b.vy = 0;
        return;
      }
      if (t === T.PLAT && sy > 0 && !drop && prevBottom <= ty * TILE + 1) {
        b.y = ty * TILE - b.h; res.d = true; b.vy = 0; b.ride = null;
        return;
      }
    }
  }
  for (const d of world.dyn) {
    if (d.off) continue;
    if (b.x < d.x + d.w && b.x + b.w > d.x && b.y < d.y + d.h && b.y + b.h > d.y) {
      if (d.oneWay) {
        if (sy > 0 && !drop && prevBottom <= d.y + 1 + (d.vy > 0 ? d.vy / 60 : 0)) {
          b.y = d.y - b.h; res.d = true; b.vy = 0; b.ride = d;
          return;
        }
        continue;
      }
      if (sy > 0) { b.y = d.y - b.h; res.d = true; b.ride = d; }
      else { b.y = d.y + d.h; res.u = true; }
      b.vy = 0;
      return;
    }
  }
}

/** ¿Hay suelo justo bajo los pies? (1 px) */
export function standing(world, b, drop = false) {
  const y = b.y + b.h + 1;
  const x0 = Math.floor((b.x + 1) / TILE), x1 = Math.floor((b.x + b.w - 1) / TILE);
  const ty = Math.floor(y / TILE);
  for (let tx = x0; tx <= x1; tx++) {
    const t = world.get(tx, ty);
    if (t === T.SOLID) return true;
    if (t === T.PLAT && !drop && b.y + b.h <= ty * TILE + 1.5) return true;
  }
  for (const d of world.dyn) {
    if (d.off) continue;
    if (b.x + 1 < d.x + d.w && b.x + b.w - 1 > d.x && y >= d.y && y <= d.y + 3 && b.y + b.h <= d.y + 1.5) {
      return d;
    }
  }
  return false;
}

export function solidOverlap(world, r) {
  const x0 = Math.floor(r.x / TILE), x1 = Math.floor((r.x + r.w - EPS) / TILE);
  const y0 = Math.floor(r.y / TILE), y1 = Math.floor((r.y + r.h - EPS) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (world.get(tx, ty) === T.SOLID) return true;
  for (const d of world.dyn) {
    if (d.oneWay || d.off) continue;
    if (r.x < d.x + d.w && r.x + r.w > d.x && r.y < d.y + d.h && r.y + r.h > d.y) return true;
  }
  return false;
}
