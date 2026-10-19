// Mapa de tiles + metadatos del nivel (sin DOM: se usa también desde Node).
import { TILE } from './config.js';
import { clamp } from './util.js';

export const T = { AIR: 0, SOLID: 1, PLAT: 2, SPIKE: 3, LAVA: 4 };
export const TILE_NAMES = ['Aire', 'Sólido', 'Plataforma', 'Pinchos', 'Lava'];

export class World {
  constructor(w = 60, h = 30, theme = 'lab', name = 'Nivel') {
    this.w = w;
    this.h = h;
    this.theme = theme;
    this.name = name;
    this.tiles = new Uint8Array(w * h);
    this.start = { x: 3, y: h - 3 };
    this.checkpoints = [];
    this.exit = null;
    this.amulets = []; // {type,x,y}
    this.signs = []; // {x,y,text}
    this.enemies = []; // {type,x,y}
    this.decor = []; // {type,x,y}
    this.props = []; // {type,x,y,...}
    this.dyn = []; // rectas sólidas dinámicas (trampillas, cortinas, góndolas)
    this.abilities = ['jump']; // lo que el validador permite usar
    this.meta = {};
  }

  inBounds(tx, ty) {
    return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h;
  }
  get(tx, ty) {
    if (tx < 0 || tx >= this.w || ty < 0) return T.SOLID;
    if (ty >= this.h) return T.SOLID;
    return this.tiles[ty * this.w + tx];
  }
  set(tx, ty, v) {
    if (this.inBounds(tx, ty)) this.tiles[ty * this.w + tx] = v;
  }
  isSolid(tx, ty) {
    return this.get(tx, ty) === T.SOLID;
  }
  solidAtPx(x, y) {
    const t = this.get(Math.floor(x / TILE), Math.floor(y / TILE));
    if (t === T.SOLID) return true;
    for (const d of this.dyn) {
      if (!d.oneWay && !d.off && x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return true;
    }
    return false;
  }
  fill(x0, y0, w, h, v) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, v);
  }
  get pxW() { return this.w * TILE; }
  get pxH() { return this.h * TILE; }

  /** Línea de visión (ignora tiles no sólidos y plataformas). */
  los(x1, y1, x2, y2) {
    const d = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(1, Math.ceil(d / 8));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.solidAtPx(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
    }
    return true;
  }
  /** Primer punto sólido recorriendo un rayo; devuelve la distancia (o max). */
  ray(x, y, dx, dy, max) {
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    for (let d = 0; d < max; d += 4) if (this.solidAtPx(x + dx * d, y + dy * d)) return d;
    return max;
  }
  /** Y (px) del primer suelo (sólido o plataforma) bajo (x,y) hasta max px; null si no hay. */
  floorBelow(x, y, max = 2000, oneWay = true) {
    const tx = Math.floor(x / TILE);
    const y0 = Math.floor(y / TILE);
    const y1 = Math.min(this.h - 1, Math.floor((y + max) / TILE));
    for (let ty = y0; ty <= y1; ty++) {
      const t = this.get(tx, ty);
      if (t === T.SOLID || (oneWay && t === T.PLAT)) return ty * TILE;
    }
    return null;
  }
  ceilingAbove(x, y, max = 2000) {
    const tx = Math.floor(x / TILE);
    const y0 = Math.floor(y / TILE);
    const y1 = Math.max(0, Math.floor((y - max) / TILE));
    for (let ty = y0; ty >= y1; ty--) if (this.get(tx, ty) === T.SOLID) return (ty + 1) * TILE;
    return null;
  }
  /** Altura libre (en tiles de aire) sobre una casilla. */
  freeAbove(tx, ty) {
    let n = 0;
    while (ty - n - 1 >= 0 && this.get(tx, ty - n - 1) === T.AIR) n++;
    return n;
  }

  /** Hazards que tocan un rectángulo en px. Devuelve 'lava' | 'spike' | null. */
  hazardAt(r) {
    const x0 = Math.floor(r.x / TILE), x1 = Math.floor((r.x + r.w - 0.01) / TILE);
    const y0 = Math.floor(r.y / TILE), y1 = Math.floor((r.y + r.h - 0.01) / TILE);
    let res = null;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = this.get(tx, ty);
        if (t === T.LAVA) {
          if (r.y + r.h > ty * TILE + 8) return 'lava';
        } else if (t === T.SPIKE) {
          const hx = tx * TILE + 3, hy = ty * TILE + 14;
          if (r.x < hx + 26 && r.x + r.w > hx && r.y < hy + 18 && r.y + r.h > hy) res = 'spike';
        }
      }
    }
    return res;
  }

  // ---- serialización -------------------------------------------------
  toJSON() {
    // RLE compacto: "valor:cuenta;"
    let rle = '';
    let prev = this.tiles[0], n = 0;
    for (let i = 0; i < this.tiles.length; i++) {
      if (this.tiles[i] === prev) n++;
      else { rle += `${prev}:${n};`; prev = this.tiles[i]; n = 1; }
    }
    rle += `${prev}:${n};`;
    return {
      v: 1, name: this.name, theme: this.theme, w: this.w, h: this.h, rle,
      start: this.start, checkpoints: this.checkpoints, exit: this.exit,
      amulets: this.amulets, signs: this.signs, enemies: this.enemies,
      decor: this.decor, props: this.props, abilities: this.abilities, meta: this.meta,
    };
  }
  static fromJSON(o) {
    const w = new World(o.w, o.h, o.theme, o.name);
    let i = 0;
    for (const part of o.rle.split(';')) {
      if (!part) continue;
      const [v, c] = part.split(':').map(Number);
      w.tiles.fill(v, i, i + c);
      i += c;
    }
    w.start = o.start; w.checkpoints = o.checkpoints || []; w.exit = o.exit || null;
    w.amulets = o.amulets || []; w.signs = o.signs || []; w.enemies = o.enemies || [];
    w.decor = o.decor || []; w.props = o.props || [];
    w.abilities = o.abilities || ['jump']; w.meta = o.meta || {};
    return w;
  }
  /** Redimensiona anclando el suelo (la parte baja se conserva). */
  resize(nw, nh) {
    const t = new Uint8Array(nw * nh);
    const dy = nh - this.h;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const nx = x, ny = y + dy;
        if (nx < nw && ny >= 0 && ny < nh) t[ny * nw + nx] = this.tiles[y * this.w + x];
      }
    }
    const shift = (o) => { o.y += dy; return o; };
    this.checkpoints.forEach(shift); this.amulets.forEach(shift); this.signs.forEach(shift);
    this.enemies.forEach(shift); this.decor.forEach(shift); this.props.forEach(shift);
    if (this.exit) shift(this.exit);
    shift(this.start);
    for (const l of [this.checkpoints, this.amulets, this.signs, this.enemies, this.decor, this.props]) {
      for (let i = l.length - 1; i >= 0; i--) if (l[i].y < 0 || l[i].x >= nw) l.splice(i, 1);
    }
    this.w = nw; this.h = nh; this.tiles = t;
    this.start.x = clamp(this.start.x, 1, nw - 2);
    this.start.y = clamp(this.start.y, 1, nh - 2);
  }
}
