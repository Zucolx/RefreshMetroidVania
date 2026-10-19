// Validador de niveles (sin DOM, sin dependencias): alcance por simulación física con las mismas constantes del juego.
//  · alcance de inicio, puntos de guardado, amuletos y salida con las habilidades permitidas (world.abilities)
//  · vuelta al inicio desde cualquier punto alcanzable (sin zonas-trampa)
//  · apoyo firme de los puntos clave
//  · escaleras de plataformas subibles desde su suelo
//  · teatro con trampillas abiertas
import { CONFIG, TILE } from './config.js';
import { Body, moveBody, solidOverlap } from './physics.js';
import { T } from './world.js';
import { createProp } from './props.js';

const DT = 1 / 60;
const PW = 22, PH = 42;

export function prepareWorld(world) {
  world.dyn = [];
  world.openTrapdoors = true; // el validador comprueba con trampillas y cortinas abiertas
  const g = { world, fx: { burst() {}, ring() {} }, enemies: [], player: {} };
  for (const s of world.props || []) if (s.type === 'trapdoor' || s.type === 'curtain') createProp(g, s);
}

export class Reach {
  constructor(world, abilities) {
    this.w = world;
    this.ab = new Set(abilities || ['jump']);
    this.cache = new Map(); // nodo -> [vecinos]
  }
  key(tx, row) { return row * this.w.w + tx; }
  unkey(k) { return [k % this.w.w, Math.floor(k / this.w.w)]; }
  /** ¿Se puede estar de pie en (tx,row)? row = fila del tile de apoyo. */
  isNode(tx, row) {
    const w = this.w;
    if (tx < 1 || tx >= w.w - 1 || row < 2 || row >= w.h) return false;
    const t = w.get(tx, row);
    if (t !== T.SOLID && t !== T.PLAT) return false;
    const b = { x: tx * TILE + TILE / 2 - PW / 2, y: row * TILE - PH, w: PW, h: PH };
    if (solidOverlap(w, b)) return false;
    if (w.hazardAt(b)) return false;
    return true;
  }
  makeBody(tx, row) {
    return new Body(tx * TILE + TILE / 2 - PW / 2, row * TILE - PH, PW, PH);
  }
  landing(b) {
    const row = Math.round((b.y + b.h) / TILE);
    const c = Math.floor((b.x + b.w / 2) / TILE);
    // el apoyo puede ser el tile del centro o uno de los que roza el cuerpo (aterrizar en el borde de un saliente)
    for (const tx of [c, Math.floor((b.x + 1) / TILE), Math.floor((b.x + b.w - 1) / TILE)]) {
      if (this.isNode(tx, row)) return this.key(tx, row);
    }
    return null;
  }
  /** Simula un vuelo. v: { dir, vx0, jump (fuerza), hold, dj, dash, sprint, drop, walkoff } */
  flight(tx, row, v) {
    const w = this.w;
    const b = this.makeBody(tx, row);
    const dir = v.dir || 0;
    const mul = v.sprint ? CONFIG.sprint.speedMul : 1;
    b.vx = v.vx0 ?? 0;
    b.vy = v.jump ? -v.jump : 0;
    let t = 0, cut = !v.jump || v.hold === undefined, djUsed = false, dashed = false, dashLeft = 0, dashDir = dir || 1, dropT = v.drop ? 0.22 : 0;
    const vmulDJ = v.sprint ? CONFIG.sprint.doubleJumpMul : 1;
    if (v.drop) b.vy = 120;
    for (let i = 0; i < 260; i++) {
      t += DT;
      if (!cut && t >= v.hold && b.vy < 0) { b.vy *= CONFIG.jumpCut; cut = true; }
      if (v.dj !== undefined && !djUsed && t >= v.dj) { b.vy = -CONFIG.doubleJumpForce * vmulDJ; djUsed = true; cut = true; }
      if (v.dash !== undefined && !dashed && t >= v.dash) { dashed = true; dashLeft = CONFIG.dash.duration; dashDir = dir || 1; b.vy = 0; }
      let vyNew = null;
      if (dashLeft > 0) {
        dashLeft -= DT; b.vx = dashDir * CONFIG.dash.speed; b.vy = 0;
        if (dashLeft <= 0) b.vx = dashDir * CONFIG.runSpeed * (dir === dashDir ? CONFIG.sprint.speedMul : 0.8);
      } else {
        const target = dir * CONFIG.runSpeed * (dashed ? CONFIG.sprint.speedMul : mul);
        const a = CONFIG.accelAir * DT;
        b.vx += Math.max(-a, Math.min(a, target - b.vx));
        const vOld = b.vy;
        vyNew = Math.min(vOld + CONFIG.gravity * DT, CONFIG.maxFall);
        b.vy = (vOld + vyNew) / 2;
      }
      if (dropT > 0) dropT -= DT;
      const res = moveBody(w, b, DT, { drop: dropT > 0 });
      if (vyNew !== null && !res.d && !res.u) b.vy = vyNew;
      if (res.u) cut = true;
      if (w.hazardAt({ x: b.x + 2, y: b.y + 2, w: b.w - 4, h: b.h - 3 })) return null;
      if (res.d && i > 1) return this.landing(b);
      if (b.y > w.pxH + 64) return null;
    }
    return null;
  }

  neighbors(k) {
    let list = this.cache.get(k);
    if (list) return list;
    list = [];
    const out = new Set();
    const [tx, row] = this.unkey(k);
    const w = this.w;
    const add = (n) => { if (n !== null && n !== k && !out.has(n)) { out.add(n); list.push(n); } };
    // caminar
    for (const d of [-1, 1]) {
      const nx = tx + d;
      if (this.isNode(nx, row)) {
        const sw = { x: Math.min(tx, nx) * TILE + TILE / 2 - PW / 2, y: row * TILE - PH, w: TILE + PW, h: PH };
        if (!solidOverlap(w, sw)) add(this.key(nx, row));
      } else {
        // salir del borde cayendo
        add(this.flight(tx, row, { dir: d, vx0: d * CONFIG.runSpeed }));
        add(this.flight(tx, row, { dir: 0, vx0: d * CONFIG.runSpeed * 0.5 }));
      }
    }
    if (w.get(tx, row) === T.PLAT) add(this.flight(tx, row, { dir: 0, drop: true }));
    // saltos normales
    const J = CONFIG.jumpForce;
    const holds = [0.07, 0.14, 0.22, 0.34, 0.6];
    for (const d of [-1, 0, 1]) {
      for (const h of holds) {
        add(this.flight(tx, row, { dir: d, vx0: d * CONFIG.runSpeed, jump: J, hold: h }));
        if (this.ab.has('double')) for (const dj of [0.2, 0.34, 0.5]) add(this.flight(tx, row, { dir: d, vx0: d * CONFIG.runSpeed, jump: J, hold: h, dj }));
        if (this.ab.has('dash')) {
          for (const ds of [0.05, 0.25, 0.45]) add(this.flight(tx, row, { dir: d || 1, vx0: (d || 1) * CONFIG.runSpeed, jump: J, hold: h, dash: ds }));
          if (this.ab.has('double')) for (const dj of [0.2, 0.34]) for (const ds of [0.05, 0.4, 0.6]) add(this.flight(tx, row, { dir: d || 1, vx0: (d || 1) * CONFIG.runSpeed, jump: J, hold: h, dj, dash: ds }));
        }
      }
      // salto con sprint (tras un dash en el suelo)
      if (this.ab.has('dash') && d) {
        const J2 = J * CONFIG.sprint.jumpMul, vx = d * CONFIG.runSpeed * CONFIG.sprint.speedMul;
        for (const h of [0.14, 0.34, 0.6]) {
          add(this.flight(tx, row, { dir: d, vx0: vx, jump: J2, hold: h, sprint: true }));
          if (this.ab.has('double')) for (const dj of [0.25, 0.4, 0.55]) add(this.flight(tx, row, { dir: d, vx0: vx, jump: J2, hold: h, dj, sprint: true }));
        }
      }
    }
    // salto alto (↑ + mantener, quieto): 1 s → 950, 2 s → 1300
    if (this.ab.has('high')) {
      for (const F of [CONFIG.highJump.f1, CONFIG.highJump.f2]) {
        for (const d of [-1, 0, 1]) {
          for (const h of [0.5, 5]) {
            add(this.flight(tx, row, { dir: d, vx0: 0, jump: F, hold: h }));
            if (this.ab.has('double')) for (const dj of [0.3, 0.5, 0.7]) add(this.flight(tx, row, { dir: d, vx0: 0, jump: F, hold: 5, dj }));
          }
        }
      }
    }
    this.cache.set(k, list);
    return list;
  }

  /** Conjunto alcanzable desde un nodo. */
  from(startKey) {
    const seen = new Set([startKey]);
    const q = [startKey];
    while (q.length) {
      const k = q.pop();
      for (const n of this.neighbors(k)) if (!seen.has(n)) { seen.add(n); q.push(n); }
    }
    return seen;
  }
}

/** Valida un nivel. Devuelve { ok, errors, warnings, stats }. */
export function validateWorld(world, opts = {}) {
  prepareWorld(world);
  const errors = [], warnings = [];
  const ab = opts.abilities || world.abilities || ['jump'];
  const R = new Reach(world, ab);
  const nodeOf = (c) => R.key(c.x, c.y + 1);

  const st = world.start;
  const startK = nodeOf(st);
  // apoyo firme de los puntos clave
  const keyPoints = [{ n: 'inicio', c: st }, ...world.checkpoints.map((c, i) => ({ n: `punto de guardado ${i + 1}`, c })), ...world.amulets.map((c) => ({ n: `amuleto ${c.type}`, c })), ...(world.exit ? [{ n: 'salida', c: world.exit }] : [])];
  for (const { n, c } of keyPoints) {
    const below = world.get(c.x, c.y + 1);
    if (below !== T.SOLID) errors.push(`${n} (${c.x},${c.y}) sin suelo firme debajo`);
    if (world.get(c.x, c.y) !== T.AIR || world.get(c.x, c.y - 1) !== T.AIR) errors.push(`${n} (${c.x},${c.y}) dentro de un sólido`);
  }
  if (!R.isNode(st.x, st.y + 1)) errors.push('el inicio no es una posición válida');
  const reach = R.from(startK);
  for (const { n, c } of keyPoints) if (!reach.has(nodeOf(c))) errors.push(`${n} (${c.x},${c.y}) no es alcanzable desde el inicio con [${ab.join(', ')}]`);

  // vuelta al inicio: búsqueda inversa
  const rev = new Map();
  for (const k of reach) for (const n of R.neighbors(k)) { if (!rev.has(n)) rev.set(n, []); rev.get(n).push(k); }
  const back = new Set([startK]);
  const q = [startK];
  while (q.length) { const k = q.pop(); for (const p of rev.get(k) || []) if (!back.has(p)) { back.add(p); q.push(p); } }
  const traps = [...reach].filter((k) => !back.has(k));
  if (traps.length) {
    // agrupa por zona para el informe
    const sample = traps.slice(0, 6).map((k) => R.unkey(k).join(','));
    errors.push(`zona-trampa: ${traps.length} posiciones alcanzables sin vuelta al inicio (p. ej. ${sample.join(' · ')})`);
  }

  // escaleras de plataformas subibles desde su suelo
  for (const l of world.meta.ladders || []) {
    // nodo en el suelo del tramo inferior, junto al pozo
    let base = null;
    for (let dx = -2; dx < l.w + 2 && base === null; dx++) { const tx = l.x + dx; if (R.isNode(tx, l.yBottom)) base = R.key(tx, l.yBottom); }
    let top = null;
    for (const dx of [-2, -1, l.w, l.w + 1]) { const tx = l.x + dx; if (R.isNode(tx, l.yTop)) top = R.key(tx, l.yTop); }
    if (base === null || top === null) { warnings.push(`escalera en x=${l.x}: no se hallan nodos base/cima`); continue; }
    const up = R.from(base);
    if (!up.has(top)) errors.push(`escalera en x=${l.x} (${l.yBottom}→${l.yTop}): no se puede subir desde su suelo`);
  }

  return { ok: errors.length === 0, errors, warnings, stats: { nodes: R.cache.size, reachable: reach.size, abilities: ab } };
}
