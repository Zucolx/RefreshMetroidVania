// Constructor de niveles en 3 pasadas:
//   1) ESTRUCTURA: franjas (bandas) horizontales con perfil de suelo/techo → se excava en un mundo sólido;
//      conectores verticales (pozos con escaleras de plataformas) y peligros de suelo.
//   2) ENEMIGOS/OBSTÁCULOS: se reparten sobre los tramos ya construidos.
//   3) DECORADO: respeta la altura libre disponible.
// Reglas: escalones ≤ 3 tiles (el salto normal sube 3,75); escaleras de plataformas cada 3 tiles sobre el suelo real;
// los pozos de peligro nunca atrapan (pinchos/lava devuelven a la última posición segura).
import { World, T } from '../world.js';
import { mulberry32 } from '../util.js';
import { DECOR } from '../decor.js';

const MAXSTEP = 3;

class Band {
  constructor(b, id, o) {
    this.b = b; this.id = id;
    this.x0 = o.x0; this.x1 = o.x1; this.base = o.base; this.nominal = o.base; this.ceil = o.ceil ?? 10;
    this.cur = o.x0;
    this.fl = new Int16Array(b.w); this.top = new Int16Array(b.w);
    this.chunks = [];
    this.feats = [];
    this.table = o.table || [['flat', 4], ['up', 1], ['down', 1], ['pit', 1]];
    this.hopHz = o.hopHz || 'lava';
    this.pitHz = o.pitHz || 'spike';
  }
  get rng() { return this.b.rng; }
  get left() { return (this.limit ?? this.x1) - this.cur; }
  /** Cambia el nivel del suelo para los siguientes tramos (|h| ≤ 3). */
  shift(h) {
    const nb = this.base - h;
    if (Math.abs(h) > MAXSTEP) throw new Error(`escalón > ${MAXSTEP}`);
    if (Math.abs(nb - this.nominal) > 4) return this;
    this.base = nb;
    return this;
  }
  _cols(n, floor, ceilH, kind, extra = {}) {
    n = Math.min(n, this.left);
    if (n <= 0) return null;
    for (let x = this.cur; x < this.cur + n; x++) { this.fl[x] = floor; this.top[x] = Math.max(1, floor - ceilH); }
    const c = { kind, x0: this.cur, x1: this.cur + n, fl: floor, ceilH, band: this.id, ...extra };
    this.chunks.push(c);
    this.cur += n;
    return c;
  }
  flat(n, kind = 'flat', ceilH = this.ceil) { this._cols(n, this.base, ceilH, kind); return this; }
  arena(n, ceilH = this.ceil + 4) { return this.flat(n, 'arena', ceilH); }
  lowceil(n, h = 3) { return this.flat(n, 'lowceil', h); }
  /** Sube o baja con una escalinata de tramos cortos. dir>0 sube. */
  stairs(steps, stepH = 1, stepW = 4, dir = 1) {
    for (let i = 0; i < steps; i++) { this.flat(stepW, 'stairs'); this.shift(dir * stepH); }
    return this;
  }
  /** Foso de pinchos/lava de ancho ≤ 4 (se salta). */
  pit(n, hz = 'spike', depth = 3) {
    const fl = this.base + depth;
    const c = this._cols(n, fl, this.ceil + depth, 'pit', { hz });
    if (c) for (let x = c.x0; x < c.x1; x++) this.feats.push({ t: 'tile', x, y: fl - 1, v: hz === 'lava' ? T.LAVA : T.SPIKE });
    return this;
  }
  /** Fila de pinchos sobre el suelo (n ≤ 3). */
  spikes(n) {
    const c = this._cols(n, this.base, this.ceil, 'spikes');
    if (c) for (let x = c.x0; x < c.x1; x++) this.feats.push({ t: 'tile', x, y: this.base - 1, v: T.SPIKE });
    return this;
  }
  /** Foso ancho con plataformas de salto: n ≥ 8. */
  hops(n, hz = 'lava', depth = 6) {
    const fl = this.base + depth;
    const c = this._cols(n, fl, this.ceil + depth + 2, 'hops', { hz });
    if (!c) return this;
    for (let x = c.x0; x < c.x1; x++) {
      this.feats.push({ t: 'tile', x, y: fl - 1, v: hz === 'lava' ? T.LAVA : T.SPIKE });
      if (hz === 'lava') this.feats.push({ t: 'tile', x, y: fl - 2, v: T.LAVA });
    }
    // plataformas a ras de suelo, separadas por huecos de 2-3 tiles; el último hueco hasta el suelo es ≤ 4
    let end = c.x0, k = 0;
    for (;;) {
      const rem = c.x1 - end;
      if (rem <= 4) break;
      const gap = Math.min(this.rng.int(2, 3), rem - 3);
      const px = end + gap;
      const dy = this.rng.int(-1, 1) * (k % 2 ? 1 : 0);
      this.feats.push({ t: 'plat', x: px, y: this.base + dy, w: 3 });
      end = px + 3; k++;
    }
    const x = end;
    c.platsEnd = x;
    return this;
  }
  /** Tramo con plataformas flotantes superpuestas (ruta alta opcional). */
  platRow(n, ceilH = this.ceil + 2) {
    const c = this._cols(n, this.base, ceilH, 'platRow');
    if (!c) return this;
    let x = c.x0 + 2, y = this.base - 3, k = 0;
    while (x + 3 < c.x1 - 1) {
      this.feats.push({ t: 'plat', x, y, w: 3 });
      x += this.rng.int(4, 5);
      y = Math.max(this.base - 6, Math.min(this.base - 3, y + (k % 2 ? 3 : -3 + 0)));
      k++;
    }
    return this;
  }
  /** Reserva un tramo llano para un pozo en x..x+w (rellena antes con la tabla de la banda). */
  slot(x, w, table = this.table) {
    if (this.cur > x - 3) throw new Error(`banda ${this.id}: pozo en x=${x} solapa con lo ya construido (cur=${this.cur})`);
    this.fillTo(x - 3, table);
    return this.flat(w + 6, 'flat');
  }
  /** Rellena con tramos aleatorios hasta la columna `x` (o el final de la banda). */
  fillTo(x, table = this.table) {
    const rng = this.rng;
    x = Math.min(x, this.x1);
    const prev = this.limit;
    this.limit = x;
    while (this.cur < x) {
      const rem = x - this.cur;
      if (rem < 14) { this.flat(rem); break; }
      const pick = rng.pick(table.flatMap(([k, w]) => Array(w).fill(k)));
      this.piece(pick, rem);
    }
    this.limit = prev;
    return this;
  }
  piece(k, rem) {
    const r = this.rng;
    switch (k) {
      case 'flat': this.flat(Math.min(rem, r.int(6, 14))); break;
      case 'up': this.flat(4).shift(r.int(1, 3)).flat(Math.min(rem - 4, r.int(5, 10))); break;
      case 'down': this.flat(4).shift(-r.int(1, 3)).flat(Math.min(rem - 4, r.int(5, 10))); break;
      case 'stairsUp': this.stairs(r.int(2, 3), r.int(1, 2), r.int(3, 4), 1); break;
      case 'stairsDown': this.stairs(r.int(2, 3), r.int(1, 2), r.int(3, 4), -1); break;
      case 'pit': this.flat(3).pit(r.int(2, 4), this.pitHz).flat(3); break;
      case 'lavapit': this.flat(3).pit(r.int(2, 4), 'lava').flat(3); break;
      case 'spikes': this.flat(3).spikes(r.int(1, 3)).flat(3); break;
      case 'hops': if (rem >= 18) this.flat(3).hops(r.int(9, 13), this.hopHz).flat(3); else this.flat(rem); break;
      case 'low': if (rem >= 14) this.flat(2).lowceil(r.int(8, 12), 3).flat(2); else this.flat(rem); break;
      case 'arena': if (rem >= 18) this.arena(r.int(14, 18)); else this.flat(rem); break;
      case 'platRow': if (rem >= 14) this.platRow(r.int(12, 16)); else this.flat(rem); break;
      default: this.flat(Math.min(rem, 8));
    }
  }
}

export class LevelBuilder {
  constructor({ w, h, theme, name, seed = 1 }) {
    this.w = w; this.h = h; this.theme = theme; this.name = name;
    this.rng = mulberry32(seed);
    this.bands = new Map();
    this.shafts = [];
    this.spawns = []; this.decor = []; this.props = []; this.signs = []; this.checkpoints = []; this.amulets = [];
    this.ladders = [];
    this.extra = []; // operaciones libres tras la excavación: fn(world)
    this.startPos = null; this.exitPos = null;
    this.reserved = []; // [x0,x1] columnas donde no hay enemigos ni decorado
    this.abilities = ['jump'];
  }
  band(id, o) { const b = new Band(this, id, o); this.bands.set(id, b); return b; }

  /** Conector vertical (pozo + escalera de plataformas). `upper` y `lower` deben tener suelo llano en x-2..x+w+2. */
  shaft(upper, lower, x, w = 6, opts = {}) {
    this.shafts.push({ upper, lower, x, w, ...opts });
    this.reserved.push([x - 1, x + w + 1]);
    return this;
  }
  /** Pozo con trampillas (el hueco de arriba se tapa con trampillas dinámicas). */
  trapShaft(upper, lower, x, w = 4, doors = 2, opts = {}) {
    this.shafts.push({ upper, lower, x, w, trap: true, noLadder: true, doors, ...opts });
    this.reserved.push([x - 1, x + w + 1]);
    return this;
  }
  sign(x, bandId, text) { this.signs.push({ x, band: bandId, text }); this.reserved.push([x - 1, x + 1]); }
  checkpoint(x, bandId) { this.checkpoints.push({ x, band: bandId }); this.reserved.push([x - 3, x + 3]); }
  amulet(type, x, bandId) { this.amulets.push({ type, x, band: bandId }); this.reserved.push([x - 2, x + 2]); }

  /** Altura de suelo (fila del tile) de una banda en la columna x. */
  floorRow(bandId, x) { return this.bands.get(bandId).fl[x]; }

  // ---------------------------------------------------------------- pasada 1: estructura
  finish() {
    const { w, h } = this;
    const world = new World(w, h, this.theme, this.name);
    world.fill(0, 0, w, h, T.SOLID);
    for (const b of this.bands.values()) {
      for (const c of b.chunks) {
        for (let x = c.x0; x < c.x1; x++) for (let y = b.top[x]; y < b.fl[x]; y++) world.set(x, y, T.AIR);
      }
    }
    for (const b of this.bands.values()) {
      for (const f of b.feats) {
        if (f.t === 'tile') world.set(f.x, f.y, f.v);
        else if (f.t === 'plat') for (let i = 0; i < f.w; i++) world.set(f.x + i, f.y, T.PLAT);
      }
    }
    for (const s of this.shafts) this.buildShaft(world, s);
    for (const fn of this.extra) fn(world, this);
    // bordes sólidos
    world.fill(0, 0, 1, h, T.SOLID); world.fill(w - 1, 0, 1, h, T.SOLID);
    world.fill(0, 0, w, 1, T.SOLID); world.fill(0, h - 1, w, 1, T.SOLID);
    this.world = world;
    return world;
  }

  buildShaft(world, s) {
    const { upper: U, lower: L, x, w } = s;
    const fU = U.fl[x], fL = L.fl[x];
    for (let i = -2; i <= w + 1; i++) {
      if (U.fl[x + i] !== fU || L.fl[x + i] !== fL) throw new Error(`pozo ${U.id}->${L.id} en x=${x}: suelo no llano (${U.fl[x + i]} vs ${fU}, ${L.fl[x + i]} vs ${fL})`);
    }
    // excava desde el suelo del tramo superior hasta el aire del inferior
    for (let cx = x; cx < x + w; cx++) for (let y = fU; y < fL; y++) world.set(cx, y, T.AIR);
    // pasarela fina sobre el hueco: la ruta principal lo cruza andando y se sube/baja por ella (↓ + salto)
    if (s.cover) for (let cx = x; cx < x + w; cx++) world.set(cx, fU, T.PLAT);
    // hueco del suelo superior: vuelve sólido el borde para que sea un pozo limpio (ya lo está)
    if (s.noLadder) {
      if (s.trap) {
        s.doorsList = [];
        const dw = Math.floor(w / s.doors);
        for (let i = 0; i < s.doors; i++) this.props.push({ type: 'trapdoor', x: x + i * dw, y: fU, w: dw, phase: i + (s.phase || 0) });
      }
      return;
    }
    // escalera: plataformas de 3 tiles cada 3 sobre el suelo REAL del tramo inferior, alternando lados
    const rungs = [];
    let y = fL, k = 0;
    while (y - fU > 3) { k++; y = fL - 3 * k; rungs.push({ y, side: k % 2 ? 'L' : 'R' }); }
    if (w < 9) {
      const left = x, right = x + w - 3;
      for (const r of rungs) for (let i = 0; i < 3; i++) world.set((r.side === 'L' ? left : right) + i, r.y, T.PLAT);
    } else {
      // torres anchas: escalinata diagonal con 2 tiles de solape entre escalones
      let px = x, dir = 1;
      for (const r of rungs) {
        for (let i = 0; i < 4; i++) world.set(px + i, r.y, T.PLAT);
        if (px + 2 + 3 > x + w - 1) dir = -1; else if (px - 2 < x) dir = 1;
        px += dir * 2;
      }
    }
    this.ladders.push({ x, w, yTop: fU, yBottom: fL, rungs: rungs.map((r) => r.y) });
  }

  // ---------------------------------------------------------------- colocación sobre el mundo ya excavado
  /** Columna válida más cercana a x con suelo firme y llano (±2) en la banda. */
  spot(bandId, x, { margin = 2 } = {}) {
    for (let m = margin; m >= 0; m--) {
      const r = this.spotM(bandId, x, m);
      if (r !== null) return r;
    }
    throw new Error(`sin hueco llano cerca de x=${x} en la banda ${bandId}`);
  }
  spotM(bandId, x, margin) {
    const b = this.bands.get(bandId);
    const w = this.world;
    for (let d = 0; d < 70; d++) {
      for (const sx of d ? [x - d, x + d] : [x]) {
        if (sx < b.x0 + margin + 1 || sx >= b.x1 - margin - 1 || this.isReserved(sx)) continue;
        const f = b.fl[sx];
        let ok = true;
        for (let dx = -margin; dx <= margin && ok; dx++) {
          if (b.fl[sx + dx] !== f || !this.solidFloor(w, sx + dx, f - 1) || w.get(sx + dx, f - 2) !== T.AIR) ok = false;
        }
        if (ok) return sx;
      }
    }
    return null;
  }
  setStart(bandId, x) { const sx = this.spot(bandId, x, { margin: 1 }); this.world.start = this.cellOnBand(bandId, sx); this.startPos = { band: bandId, x: sx }; this.reserved.push([sx - 2, sx + 2]); }
  setExit(bandId, x) { const sx = this.spot(bandId, x, { margin: 2 }); this.world.exit = this.cellOnBand(bandId, sx); this.reserved.push([sx - 2, sx + 2]); }
  addCheckpoint(bandId, x) { const sx = this.spot(bandId, x); this.world.checkpoints.push(this.cellOnBand(bandId, sx)); this.reserved.push([sx - 2, sx + 2]); }
  addAmulet(type, bandId, x) { const sx = this.spot(bandId, x); this.world.amulets.push({ type, ...this.cellOnBand(bandId, sx) }); this.reserved.push([sx - 2, sx + 2]); }
  addSign(bandId, x, text) { const sx = this.spot(bandId, x, { margin: 1 }); this.world.signs.push({ ...this.cellOnBand(bandId, sx), text }); this.reserved.push([sx - 1, sx + 1]); }

  // ---------------------------------------------------------------- utilidades de colocación
  cellOnBand(bandId, x) {
    const b = this.bands.get(bandId);
    return { x, y: b.fl[x] - 1 };
  }
  isReserved(x) { return this.reserved.some(([a, b2]) => x >= a && x <= b2); }
  solidFloor(world, x, y) { return world.get(x, y + 1) === T.SOLID && world.get(x, y) === T.AIR && world.get(x, y - 1) === T.AIR; }

  place() {
    const world = this.world;
    for (const c of this.checkpoints) {
      const p = this.cellOnBand(c.band, c.x);
      if (!this.solidFloor(world, p.x, p.y)) throw new Error(`punto de guardado sin suelo firme en x=${c.x}`);
      world.checkpoints.push(p);
    }
    for (const a of this.amulets) {
      const p = this.cellOnBand(a.band, a.x);
      if (!this.solidFloor(world, p.x, p.y)) throw new Error(`amuleto sin suelo firme en x=${a.x}`);
      world.amulets.push({ type: a.type, ...p });
    }
    for (const s of this.signs) {
      const p = this.cellOnBand(s.band, s.x);
      world.signs.push({ ...p, text: s.text });
    }
    if (this.startPos) { world.start = this.cellOnBand(this.startPos.band, this.startPos.x); }
    if (this.exitPos) {
      const p = this.cellOnBand(this.exitPos.band, this.exitPos.x);
      if (!this.solidFloor(world, p.x, p.y)) throw new Error(`salida sin suelo firme en x=${p.x}`);
      world.exit = p;
    }
  }

  // ---------------------------------------------------------------- pasada 2: enemigos
  /** table: [[tipo, peso]], density: enemigos por tile de tramo elegible; ceil/air: tablas opcionales. */
  populate(bandId, { table = [], ceil = [], air = [], density = 0.06, ceilDensity = 0.02, airDensity = 0.015, kinds = ['flat', 'platRow', 'arena', 'lowceil', 'stairs'], from = 0, to = 1e9, minGap = 4 }) {
    const world = this.world;
    const b = this.bands.get(bandId);
    const rng = this.rng;
    const pickFrom = (t) => rng.pick(t.flatMap(([k, wgt]) => Array(wgt).fill(k)));
    const startX = this.startPos ? this.startPos.x : 0;
    const cand = [];
    let width = 0;
    for (const c of b.chunks) {
      if (c.x1 < from || c.x0 > to || !kinds.includes(c.kind)) continue;
      width += c.x1 - c.x0;
      for (let x = c.x0 + 2; x < c.x1 - 2; x++) cand.push({ x, c });
    }
    // baraja
    for (let i = cand.length - 1; i > 0; i--) { const j = rng.int(0, i); [cand[i], cand[j]] = [cand[j], cand[i]]; }
    const taken = [];
    const free = (x) => !this.isReserved(x) && Math.abs(x - startX) >= 9 && !taken.some((t) => Math.abs(t - x) < minGap);
    const target = Math.round(width * density);
    let n = 0;
    for (const { x, c } of cand) {
      if (n >= target || !table.length) break;
      if (!free(x) || !this.solidFloor(world, x, c.fl - 1)) continue;
      const type = pickFrom(table);
      if (c.ceilH < 5 && ['treant', 'orc', 'armor'].includes(type)) continue;
      this.spawns.push({ type, x, y: c.fl - 1 });
      taken.push(x); n++;
    }
    // techo y aire
    const cc = cand.filter(({ c }) => c.ceilH >= 6);
    const nc = Math.round(width * ceilDensity), na = Math.round(width * airDensity);
    let k = 0;
    for (const { x, c } of cc) {
      if (k >= nc || !ceil.length) break;
      if (this.isReserved(x) || world.get(x, b.top[x] - 1) !== T.SOLID || world.get(x, b.top[x]) !== T.AIR) continue;
      if (this.spawns.some((s) => Math.abs(s.x - x) < 4 && s.y <= b.top[x] + 1)) continue;
      this.spawns.push({ type: pickFrom(ceil), x, y: b.top[x] }); k++;
    }
    k = 0;
    for (const { x, c } of cc.filter(({ c: cx }) => cx.ceilH >= 7)) {
      if (k >= na || !air.length) break;
      if (this.isReserved(x) || !free(x)) continue;
      this.spawns.push({ type: pickFrom(air), x, y: Math.max(b.top[x] + 2, c.fl - 6) }); taken.push(x); k++;
    }
  }

  // ---------------------------------------------------------------- pasada 3: decorado
  decorate(bandId, { table = [], density = 0.12, kinds = ['flat', 'stairs', 'arena'], from = 0, to = 1e9 }) {
    const world = this.world;
    const b = this.bands.get(bandId);
    const rng = this.rng;
    const pool = table.flatMap(([k, wgt]) => Array(wgt).fill(k));
    if (!pool.length) return;
    for (const c of b.chunks) {
      if (!kinds.includes(c.kind) || c.x1 < from || c.x0 > to) continue;
      const n = c.x1 - c.x0;
      for (let i = 0; i < n * density; i++) {
        const x = rng.int(c.x0 + 1, c.x1 - 2);
        const type = rng.pick(pool);
        const def = DECOR[type];
        if (!def || this.isReserved(x)) continue;
        if (this.spawns.some((s) => Math.abs(s.x - x) < 2 && Math.abs(s.y - (c.fl - 1)) < 2)) continue;
        if (this.decor.some((d) => Math.abs(d.x - x) < Math.max(2, def.w) && d.y === c.fl - 1)) continue;
        // altura libre y suelo firme
        if (!this.solidFloor(world, x, c.fl - 1)) continue;
        if (world.freeAbove(x, c.fl - 1) + 1 < def.h) continue;
        this.decor.push({ type, x, y: c.fl - 1 });
      }
    }
  }

  /** Construye el World final con todas las pasadas. */
  build({ abilities = this.abilities } = {}) {
    const world = this.world || this.finish();
    if (this.checkpoints.length || this.amulets.length || this.signs.length || this.startPos || this.exitPos) this.place();
    world.enemies = this.spawns.slice();
    world.decor = this.decor.slice();
    world.props = this.props.slice();
    world.abilities = abilities;
    world.meta = { ladders: this.ladders, shafts: this.shafts.map((s) => ({ x: s.x, w: s.w, upper: s.upper.id, lower: s.lower.id, trap: !!s.trap })) };
    return world;
  }
}
