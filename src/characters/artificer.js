// Artificiero (110 HP): cadena, escopeta, bombas y el Gancho (plataformas, muros, enemigos ligeros y pesados).
import { CONFIG, TILE } from '../config.js';
import { Kit } from './kit.js';
import { Projectile } from '../projectiles.js';
import { moveBody } from '../physics.js';
import { T } from '../world.js';
import { audio } from '../audio.js';
import { clamp, TAU, rrange } from '../util.js';

export class Artificer extends Kit {
  constructor() {
    super('artificer', {
      name: 'Artificiero',
      desc: 'Cadena, escopeta, bombas y un gancho que agarra casi todo.',
      pal: { skin: '#e8b88c', skinDark: '#c99a72', hair: '#3a2a22', coat: '#c8691f', pants: '#4a3a30', pantsDark: '#392c25', boots: '#2a1f1a', trim: '#8a8f99', accent: '#ffb36a', hat: 'goggles', glove: '#5a4636', vest: '#7a4a22' },
    });
    this.swingTimes = [0.26, 0.26, 0.34];
    this.chargeTime = CONFIG.artificer.shotTime;
    this.chargeSlow = CONFIG.artificer.shotSlow;
    this.flavorKinds = ['oil', 'reload'];
    this.hook = null;
    this.grab = null;
    this.aim = { x: 1, y: 0 };
    this._beat = -1;
  }

  update(p, g, dt, active) {
    if (!active) { if (this.hook) this.dropHook(p, g); return; }
    if (this.hook) this.updateHook(p, g, dt);
    if (this.grab) this.updateGrab(p, g, dt);
  }
  cancel(p, g) { /* el gancho persiste salvo daño */ }
  onSwitchOut(p, g) { this.dropHook(p, g); }
  onHurt(p, g) { this.dropHook(p, g); }
  dropHook(p, g) {
    this.hook = null;
    if (this.grab) { this.grab = null; }
    if (p.mode && p.mode.hookOwner === this) p.endMode();
  }

  // ---------- cadena ----------
  swing(p, g, i, st) {
    const A = CONFIG.artificer;
    const f = p.facing;
    const dmg = [A.dmg1, A.dmg2, A.dmg3][i];
    const info = { kind: 'chain', melee: true, dmg, knock: 240 + i * 60, dir: f, canParry: false, hitstop: 0.04, lift: i === 2 ? 220 : 0 };
    const reach = A.reach * (i === 2 ? 1.12 : 1);
    audio.sfx('slash');
    if (i === 0) p.swingAnim = { t: 0, dur: st, from: -0.3, to: 0.4, weaponRot: 0 };
    else if (i === 1) p.swingAnim = { t: 0, dur: st, from: -2.4, to: 0.5, weaponRot: 0 };
    else p.swingAnim = { t: 0, dur: st, from: 1.2, to: -1.6, weaponRot: 0 };
    this.chainT = st;
    // el golpe cae en la mitad exterior del alcance
    const half = reach / 2;
    g.addHitbox({ owner: p, shape: 'rect', w: half + 4, h: i === 1 ? 62 : 44, ox: half + half / 2 + 8, oy: i === 1 ? -14 : i === 2 ? -10 : -2, delay: 0.09, life: 0.13, info, cut: true });
    g.fx.slash(p.cx + f * (half + 18), p.cy - 8, half, i === 1 ? (f > 0 ? -1.6 : Math.PI + 1.6) : (f > 0 ? -0.9 : Math.PI + 0.9), i === 1 ? (f > 0 ? 0.9 : Math.PI - 0.9) : (f > 0 ? 0.9 : Math.PI - 0.9), 0.2, '#d6d9e0', 4);
    g.fx.dot(p.cx + f * (reach + 4), p.cy - 8, 0, 0, 0.18, '#ffffff', 5, 0);
  }

  // ---------- escopeta (mantener) ----------
  chargeUpdate(p, g, dt) {
    const a = p.aim8();
    this.aim = a;
    if (a.x) p.facing = a.x > 0 ? 1 : -1;
  }
  chargeFire(p, g) {
    const A = CONFIG.artificer;
    const a = this.aim.x || this.aim.y ? this.aim : { x: p.facing, y: 0 };
    const base = Math.atan2(a.y, a.x);
    const spread = (16 * Math.PI) / 180;
    audio.sfx('boom');
    for (let i = 0; i < A.pellets; i++) {
      const ang = base + (i / (A.pellets - 1) - 0.5) * 2 * spread + rrange(-0.02, 0.02);
      g.projectiles.push(new Projectile({
        x: p.cx + Math.cos(base) * 26, y: p.cy - 6 + Math.sin(base) * 22, vx: Math.cos(ang) * 1000, vy: Math.sin(ang) * 1000, r: 5, team: 'player', kind: 'shotgun',
        dmg: A.pelletDamage, life: A.shotRange / 1000, color: '#ffd9a0', shape: 'bullet', knock: 150, owner: p, melee: false,
      }));
    }
    g.fx.burst(p.cx + Math.cos(base) * 30, p.cy - 6 + Math.sin(base) * 26, 12, '#ffcf70', 320, 0.25, 3.5, 0, 0.9, base);
    g.fx.smoke(p.cx + Math.cos(base) * 30, p.cy - 6 + Math.sin(base) * 26, 3, 'rgba(210,200,190,0.5)', 9);
    g.shake(3, 0.12);
    // retroceso
    p.vx += -a.x * A.shotRecoil;
    if (a.y > 0.9) p.bounce(A.shotLift);
    else if (a.y > 0.2) { p.vy = Math.min(p.vy, -A.shotLift / 2); p.onGround = false; }
    p.swingAnim = { t: 0, dur: 0.25, from: 0, to: 0, weaponRot: 0 };
    p.atkLock = 0.25;
  }

  // ---------- bomba (↓ + aéreo) ----------
  airDown(p, g) {
    if (this.cd.bomb > 0) return true;
    this.cd.bomb = CONFIG.artificer.bombGap;
    const kit = this;
    const b = new Projectile({ x: p.cx, y: p.feetY + 4, vx: 0, vy: 420, r: 8, team: 'player', kind: 'bomb', dmg: 0, life: 2, grav: 1200, color: '#222', shape: 'bomb', owner: p, pierce: 0, noMana: true });
    b.info = { kind: 'bomb', dmg: 0, quiet: true, knock: 0, from: null };
    b.onUpdate = function (gg) { if (gg.world.hazardAt({ x: this.x - 4, y: this.y - 4, w: 8, h: 8 })) this.die(gg); };
    b.onDie = function (gg) { kit.bombBlast(gg, p, this.x, this.y); };
    g.projectiles.push(b);
    audio.sfx('swap');
    p.swingAnim = { t: 0, dur: 0.2, from: 1.4, to: 1.5, weaponRot: 0 };
    return true;
  }
  bombBlast(g, p, x, y) {
    const A = CONFIG.artificer;
    g.explosion(x, y, A.bombRadius, A.bombDamage, { kind: 'bomb', knock: 300, radial: true, lift: 160, color: '#ff9a3a' });
    g.fx.ring(x, y, 6, A.bombRadius, 0.3, '#ff9a3a', 5);
    g.fx.disc(x, y, 6, A.bombRadius * 0.7, 0.25, 'rgba(255,170,70,0.8)');
    g.shake(4, 0.2);
    audio.sfx('boom');
    const d = Math.hypot(p.cx - x, p.feetY - y);
    if (d < 120 && !p.onGround) {
      const boost = A.bombBoost * (1 - 0.55 * clamp(d / 120, 0, 1));
      p.bounce(boost);
    }
  }

  // ---------- Especial: gancho ----------
  specialPress(p, g) {
    if (this.cd.hook > 0 || this.hook || this.grab) return;
    if (p.mode && (p.mode.name === 'cling' || p.mode.name === 'hang')) p.endMode();
    else if (p.mode) return;
    const a = p.aim8();
    this.aim = a;
    const sp = CONFIG.artificer.hookSpeed;
    this.hook = { x: p.cx + a.x * 12, y: p.cy - 8 + a.y * 10, vx: a.x * sp + p.vx, vy: a.y * sp + p.vy, state: 'out', a, trav: 0 };
    if (a.x) p.facing = a.x > 0 ? 1 : -1;
    audio.sfx('hook');
    p.swingAnim = { t: 0, dur: 0.2, from: Math.atan2(a.y, a.x * p.facing), to: Math.atan2(a.y, a.x * p.facing), weaponRot: 0 };
    p.actionT = 0;
  }
  handPos(p) { return { x: p.cx + this.aim.x * 10, y: p.cy - 8 + this.aim.y * 8 }; }

  updateHook(p, g, dt) {
    const h = this.hook;
    const A = CONFIG.artificer;
    if (h.state === 'attached') {
      if (!p.mode || p.mode.hookOwner !== this) { this.hook = null; this.cd.hook = A.hookGap; }
      return;
    }
    const hand = this.handPos(p);
    let vx, vy;
    if (h.state === 'out') { vx = h.vx; vy = h.vy; } else {
      const dx = hand.x - h.x, dy = hand.y - h.y, d = Math.hypot(dx, dy) || 1;
      vx = (dx / d) * A.hookSpeed; vy = (dy / d) * A.hookSpeed;
      if (d < 22) { this.hook = null; this.cd.hook = A.hookGap; return; }
    }
    const dist = Math.hypot(vx, vy) * dt;
    const n = Math.max(1, Math.ceil(dist / 8));
    for (let i = 0; i < n; i++) {
      h.x += (vx * dt) / n; h.y += (vy * dt) / n;
      if (this.hookHit(p, g, h)) return;
    }
    if (h.state === 'out' && Math.hypot(h.x - hand.x, h.y - hand.y) > A.hookRange) h.state = 'back';
  }
  /** Devuelve true si el gancho se ha enganchado a algo. */
  hookHit(p, g, h) {
    // enemigos (los fantasmas se atraviesan)
    for (const e of g.enemies) {
      if (e.dead || e.untargetable || e.ghost) continue;
      if (h.x > e.x - 4 && h.x < e.x + e.w + 4 && h.y > e.y - 4 && h.y < e.y + e.h + 4) { this.attachEnemy(p, g, e); return true; }
    }
    const w = g.world;
    const tx = Math.floor(h.x / TILE), ty = Math.floor(h.y / TILE);
    const t = w.get(tx, ty);
    if (t === T.PLAT) {
      // ¿hay un enemigo sobre esa tabla? cuenta como enemigo
      for (const e of g.enemies) {
        if (e.dead || e.untargetable || e.ghost) continue;
        if (Math.abs(e.y + e.h - ty * TILE) < 8 && e.x < (tx + 1) * TILE && e.x + e.w > tx * TILE) { this.attachEnemy(p, g, e); return true; }
      }
      this.attachPlatform(p, g, h.x, ty * TILE);
      return true;
    }
    if (t === T.SOLID) {
      const above = w.get(tx, ty - 1);
      if (above !== T.SOLID && h.y - ty * TILE < 10) { this.attachPlatform(p, g, h.x, ty * TILE); return true; }
      this.attachWall(p, g, h.x - (h.vx || 0) * 0.002, h.y);
      return true;
    }
    return false;
  }

  attachEnemy(p, g, e) {
    const A = CONFIG.artificer;
    this.hook = null;
    audio.sfx('hit');
    g.fx.burst(e.cx, e.cy, 8, '#ffffff', 180, 0.3, 3, 0);
    if (e.heavy) { this.startAssault(p, g, e); return; }
    // ¿enemigo sobre plataforma ligera más alta?
    const below = g.world.get(Math.floor(e.cx / TILE), Math.floor((e.y + e.h + 2) / TILE));
    if (e.onGround && below === T.PLAT && e.y + e.h < p.feetY - 20) {
      const side = p.cx < e.cx ? -1 : 1;
      const px = e.cx + side * 36;
      p.tpTo(g.world.solidAtPx(px, e.y + e.h - 10) ? e.cx : px, e.y + e.h);
      p.vy = 0; p.onGround = true;
      g.damageEnemy(e, 6, { kind: 'chain', melee: true, knock: 0, dir: -side, stun: 0.7, from: { x: p.cx, y: p.cy } });
      g.fx.burst(p.cx, p.feetY, 12, '#ffcf70', 220, 0.4, 3, 0);
      this.cd.hook = A.hookGap;
      return;
    }
    // enemigo ligero: se atrae y estalla lanzándolo girando hacia donde apuntas
    this.grab = { e, t: 0 };
    e.stun = Math.max(e.stun, 0.3);
    e.tumble = null;
  }
  updateGrab(p, g, dt) {
    const gr = this.grab;
    const e = gr.e;
    if (!e || e.dead) { this.grab = null; this.cd.hook = CONFIG.artificer.hookGap; return; }
    gr.t += dt;
    const hand = this.handPos(p);
    const dx = p.cx - e.cx, dy = p.cy - e.cy, d = Math.hypot(dx, dy) || 1;
    e.stun = Math.max(e.stun, 0.2);
    const step = Math.min(d, CONFIG.artificer.lightPull * dt);
    e.x += (dx / d) * step; e.y += (dy / d) * step;
    g.fx.line(hand.x, hand.y, e.cx, e.cy, 0.05, '#c9ccd6', 2);
    if (d < 30 || gr.t > 1.2) {
      this.grab = null;
      const a = p.aim8();
      const A = CONFIG.artificer;
      g.fx.burst(e.cx, e.cy, 16, '#ff9a3a', 300, 0.4, 4, 100);
      g.fx.ring(e.cx, e.cy, 4, 50, 0.3, '#ff9a3a', 4);
      audio.sfx('boom');
      g.damageEnemy(e, A.throwBombDamage, { kind: 'bomb', knock: 0, from: { x: e.cx, y: e.cy }, dir: a.x || p.facing });
      if (!e.dead) e.startTumble((a.x || p.facing * (a.y ? 0.2 : 1)) * 560, a.y * 560 - 180, 1.2);
      this.cd.hook = A.hookGap;
    }
  }
  startAssault(p, g, e) {
    const A = CONFIG.artificer;
    const kit = this;
    p.endMode();
    p.mode = {
      name: 'assault', invuln: true, hookOwner: this, t: 0,
      update(pp, gg, dt) {
        this.t += dt;
        const dx = e.cx - pp.cx, dy = e.cy - pp.cy, d = Math.hypot(dx, dy) || 1;
        if (e.dead || d < 26 + Math.max(e.w, e.h) * 0.4 || this.t > 0.9) {
          // explosión al llegar
          gg.explosion(e.cx, e.cy, 85, A.assaultDamage * 0.64, { kind: 'assault', knock: 320, radial: true, lift: 150, color: '#ff9a3a' });
          if (!e.dead) gg.damageEnemy(e, A.assaultDamage, { kind: 'assault', knock: 200, dir: Math.sign(dx) || 1, from: { x: pp.cx, y: pp.cy } });
          gg.fx.ring(e.cx, e.cy, 6, 85, 0.35, '#ff9a3a', 6);
          audio.sfx('boom'); gg.shake(6, 0.3);
          const dir = Math.sign(dx) || 1;
          pp.mode = null;
          pp.vx = -dir * 280; pp.vy = -480; pp.onGround = false; pp.inv = Math.max(pp.inv, 0.4);
          pp.flip = { t: 0, dur: 0.6, dir: -dir };
          pp.airJumps = 1; pp.airDashes = pp.maxAirDashes();
          kit.hook = null; kit.cd.hook = A.hookGap;
          return true;
        }
        pp.vx = (dx / d) * A.heavyAssault; pp.vy = (dy / d) * A.heavyAssault;
        moveBody(gg.world, pp, dt);
        gg.fx.dot(pp.cx, pp.cy, 0, 0, 0.25, '#ffcf70', 5, 0);
        return true;
      },
      pose(pp, P) { P.lean = 0.9; P.arm = -0.2; P.armB = -0.3; P.legA = 0.8; P.legB = -0.2; return 'assault'; },
    };
    this.hook = { x: e.cx, y: e.cy, state: 'attached', anchor: { x: e.cx, y: e.cy }, a: this.aim };
    g.fx.text(p.cx, p.y - 12, '¡ASALTO!', '#ffb36a', 0.7, 13);
  }

  attachPlatform(p, g, ax, ay) {
    const kit = this;
    audio.sfx('hook');
    p.endMode();
    const d0 = Math.hypot(ax - p.cx, ay - p.cy);
    this.hook = { x: ax, y: ay, state: 'attached', anchor: { x: ax, y: ay }, a: this.aim };
    p.endSprint();
    p.mode = {
      name: 'hang', hookOwner: this, cancelOnHurt: true, L: d0, anchor: { x: ax, y: ay },
      update(pp, gg, dt, I) {
        const A = this.anchor;
        // recoge hasta 80 px
        if (this.L > 80) this.L = Math.max(80, this.L - 700 * dt);
        if (I.y < 0) this.L = Math.max(20, this.L - 240 * dt);
        // saltar: impulso hacia arriba y recupera el doble salto
        if (I.jumpP) { pp.mode = null; pp.vy = -CONFIG.jumpForce; pp.vx *= 1.1; pp.onGround = false; pp.airJumps = 1; pp.usedDouble = false; pp.jumpType = 'normal'; pp.cutDone = false; audio.sfx('jump'); return true; }
        if (I.y > 0 && I.y !== 0 && this.L >= 40 && I.down) { /* ↓ suelta (manejado abajo) */ }
        if (I.y > 0) { pp.mode = null; return true; }
        // subir con voltereta
        if (I.y < 0 && this.L <= 34) {
          pp.mode = null; pp.setFeet(A.x, A.y); pp.vx = pp.facing * 120; pp.vy = -380; pp.onGround = false; pp.flip = { t: 0, dur: 0.5, dir: pp.facing };
          pp.airJumps = 1; pp.airDashes = pp.maxAirDashes();
          return true;
        }
        // péndulo
        let vx = pp.vx, vy = pp.vy;
        vy += CONFIG.gravity * dt * 0.9;
        vx += I.x * 1500 * dt;
        vx *= 1 - 0.35 * dt; vy *= 1 - 0.1 * dt;
        let nx = pp.cx + vx * dt, ny = pp.cy + vy * dt;
        const dx = nx - A.x, dy = ny - A.y, d = Math.hypot(dx, dy);
        if (d > this.L) { nx = A.x + (dx / d) * this.L; ny = A.y + (dy / d) * this.L; }
        pp.vx = (nx - pp.cx) / dt; pp.vy = (ny - pp.cy) / dt;
        moveBody(gg.world, pp, dt);
        pp.onGround = false;
        if (I.x) pp.facing = I.x;
        pp.peakY = pp.y; pp.fallDist = 0;
        return true;
      },
      pose(pp, P) { P.arm = -2.7; P.armB = -2.9; P.legA = 0.3; P.legB = -0.1; P.lean = -Math.sign(pp.vx || 1) * 0.15; return 'hang'; },
    };
  }
  attachWall(p, g, ax, ay) {
    const kit = this;
    audio.sfx('hook');
    p.endMode();
    p.endSprint();
    this.hook = { x: ax, y: ay, state: 'attached', anchor: { x: ax, y: ay }, a: this.aim };
    const A = CONFIG.artificer;
    p.mode = {
      name: 'pull', hookOwner: this, cancelOnHurt: true, phase: 'pull', t: 0, hang: 0,
      update(pp, gg, dt, I) {
        if (this.phase === 'pull') {
          const dx = ax - pp.cx, dy = ay - (pp.y + 10), d = Math.hypot(dx, dy) || 1;
          if (d < 26) { this.phase = 'cling'; pp.vx = 0; pp.vy = 0; this.name = 'cling'; return true; }
          pp.vx = (dx / d) * A.wallPull; pp.vy = (dy / d) * A.wallPull;
          const r = moveBody(gg.world, pp, dt);
          pp.onGround = false;
          this.t += dt;
          if ((r.l || r.r || r.u || r.d) && d < 64) { this.phase = 'cling'; pp.vx = 0; pp.vy = 0; this.name = 'cling'; }
          if (this.t > 0.6) { this.phase = 'cling'; this.name = 'cling'; pp.vx = 0; pp.vy = 0; }
          gg.fx.dot(pp.cx, pp.cy, 0, 0, 0.2, '#ffcf70', 4, 0);
          return true;
        }
        // agarrado hasta 1,4 s
        this.hang += dt;
        pp.vx = 0; pp.vy = 0;
        pp.peakY = pp.y; pp.fallDist = 0;
        const ceil = ay < pp.y;
        if (I.jumpP) {
          const away = -Math.sign(ax - pp.cx) || -pp.facing;
          pp.mode = null; pp.vy = ceil ? -420 : -CONFIG.jumpForce * 1.05; pp.vx = away * 330; pp.facing = away || pp.facing;
          pp.onGround = false; pp.airJumps = 1; pp.usedDouble = false; pp.jumpType = 'normal'; pp.cutDone = false; audio.sfx('jump');
          return true;
        }
        if (I.y > 0 || this.hang > A.hookHang) { pp.mode = null; return true; }
        return true;
      },
      pose(pp, P) { P.arm = -2.7; P.armB = -2.6; P.legA = 0.5; P.legB = 0.2; P.kneeA = 0.8; return this.phase === 'pull' ? 'pull' : 'cling'; },
    };
  }

  specialInfo() {
    if (this.grab) return { name: 'Gancho', frac: 0.5, state: 'arrastrando' };
    if (this.hook) return { name: 'Gancho', frac: 0.3, state: this.hook.state === 'attached' ? 'enganchado' : 'lanzado' };
    return { name: 'Gancho', frac: this.cd.hook > 0 ? 1 - this.cd.hook / CONFIG.artificer.hookGap : 1, state: 'listo' };
  }

  maxDash() { return 'rocket'; }
  speedMul(p) { return 1; }

  // ---------- entrada heroica ----------
  entry(p, g) {
    const A = CONFIG.artificer;
    const x = p.cx, y = p.feetY;
    p.hidden = true;
    audio.sfx('whoosh');
    [-85, 0, 85].forEach((off, i) => {
      g.after(0.05 + i * 0.1, (gg) => {
        const bx = x + off;
        const b = new Projectile({ x: bx, y: y - 260, vx: 0, vy: 600, r: 8, team: 'player', kind: 'bomb', dmg: 0, life: 1.4, grav: 900, color: '#222', shape: 'bomb', owner: p, noWorld: false });
        b.info = { kind: 'bomb', dmg: 0, quiet: true, knock: 0, from: null };
        b.onDie = (g2) => {
          g2.explosion(b.x, b.y, 80, A.entryDamage, { kind: 'heroic', knock: 420, radial: true, lift: 200, color: '#ff9a3a' });
          g2.fx.ring(b.x, b.y, 6, 80, 0.3, '#ff9a3a', 5);
          g2.fx.smoke(b.x, b.y, 4); audio.sfx('boom'); g2.shake(5, 0.2);
        };
        gg.projectiles.push(b);
      });
    });
    g.after(0.55, (gg) => {
      p.hidden = false;
      gg.fx.smoke(x, y - 20, 10, 'rgba(120,110,105,0.7)', 18);
      gg.fx.burst(x, y - 20, 12, '#ffb36a', 200, 0.5, 3, 0);
    });
  }

  // ---------- idles ----------
  pickFlavor() {
    const k = super.pickFlavor();
    this.flavorDur = k === 'oil' ? 4.5 : 4.8;
    this._beat = -1;
    return k;
  }
  idleBase(p, t, pose) {
    super.idleBase(p, t, pose);
    pose.arm = 0.8 + Math.sin(t * 1.8) * 0.07;
    pose.armB = 0.6;
    pose.legA = 0.1; pose.legB = -0.08;
  }
  idleFlavor(p, t, kind, k, pose) {
    const mix = (a, b) => a + (b - a) * k;
    pose.headTilt = mix(pose.headTilt, 0.3);
    if (kind === 'oil') {
      pose.arm = mix(pose.arm, 0.5); pose.armB = mix(pose.armB, 0.4 + Math.sin(t * 8) * 0.3);
      const b = Math.floor(t * 2);
      if (b !== this._beat) { this._beat = b; audio.sfx('shake'); }
    } else {
      pose.arm = mix(pose.arm, 0.2); pose.armB = mix(pose.armB, 0.5 + Math.sin(t * 5) * 0.12);
      const b = Math.floor(t / 1.2);
      if (b !== this._beat) { this._beat = b; audio.sfx('hook'); }
    }
  }
  drawFlavor(ctx, p, pose, kind, k, t) {
    ctx.save(); ctx.globalAlpha *= k;
    if (kind === 'oil') {
      ctx.fillStyle = '#b8bcc6'; ctx.fillRect(10, -26, 22, 3);
      ctx.fillStyle = '#d8b84a'; for (let i = 0; i < 3; i++) { const ph = (t * 1.2 + i * 0.3) % 1; ctx.globalAlpha = k * (1 - ph); ctx.fillRect(14 + i * 7, -24 + ph * 12, 2, 3); }
      ctx.globalAlpha = k; ctx.fillStyle = '#7a6040'; ctx.fillRect(8 + Math.sin(t * 8) * 6, -30, 8, 4);
    } else {
      this.drawShotgun(ctx, Math.sin(t * 1.2) > 0 ? -0.25 : 0.1, true);
      ctx.fillStyle = '#e8d070'; for (let i = 0; i < 2; i++) ctx.fillRect(22 + i * 4, -18 + ((t * 40) % 20), 3, 5);
    }
    ctx.restore();
  }
  drawShotgun(c, bend = 0, own = false) {
    c.save();
    if (own) c.translate(10, -24);
    c.fillStyle = '#5a3a22'; c.fillRect(-6, -2.5, 14, 5);
    c.save(); c.rotate(bend);
    c.fillStyle = '#3a3f4a'; c.fillRect(6, -3, 26, 3); c.fillRect(6, 0.5, 26, 3);
    c.restore();
    c.restore();
  }

  // ---------- dibujo ----------
  drawWeapon(c, p, pose) {
    if (p.charging || this.chargeShow) { // escopeta apuntada
      c.fillStyle = '#5a3a22'; c.fillRect(-10, -3, 16, 6);
      c.fillStyle = '#3a3f4a'; c.fillRect(6, -3.5, 30, 3.4); c.fillRect(6, 0.2, 30, 3.4);
      c.fillStyle = '#c9cdd6'; c.fillRect(34, -4, 2, 8);
      return;
    }
    // cadena con pesa: más extendida durante el golpe
    c.fillStyle = '#6a5a4a'; c.fillRect(-4, -2, 9, 4);
    const ext = p.swingAnim ? 1 : 0.35;
    c.strokeStyle = '#b8bcc6'; c.lineWidth = 2.2; c.lineCap = 'round';
    const L = 34 * ext + 8;
    c.beginPath(); c.moveTo(5, 0);
    for (let i = 1; i <= 6; i++) { const t = i / 6; c.lineTo(5 + L * t, Math.sin(t * 5 + performance.now() / 160) * 2 * (1 - ext) + (1 - ext) * t * t * 12); }
    c.stroke();
    c.fillStyle = '#8a8f99'; c.beginPath(); c.arc(5 + L, (1 - ext) * 12, 5, 0, TAU); c.fill();
    c.fillStyle = '#c9cdd6'; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; c.fillRect(5 + L + Math.cos(a) * 5 - 1, (1 - ext) * 12 + Math.sin(a) * 5 - 1, 2, 2); }
  }
  poseMod(p, pose) {
    if (p.charging && !p.chargeFired) {
      const a = Math.atan2(this.aim.y, this.aim.x * p.facing);
      pose.arm = a; pose.weaponRot = 0; pose.armB = a + 0.15; pose.lean = 0.12;
    } else if (p.charging) { pose.lean = -0.1; }
  }
  drawOver(ctx, p) {
    if (p.charging && !p.chargeFired) {
      // dos líneas discontinuas muestran el cono de la escopeta
      const a = Math.atan2(this.aim.y, this.aim.x * p.facing);
      const sp = (16 * Math.PI) / 180;
      ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,230,160,0.75)'; ctx.lineWidth = 1.5;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(Math.cos(a + s * sp) * CONFIG.artificer.shotRange, -22 + Math.sin(a + s * sp) * CONFIG.artificer.shotRange); ctx.stroke();
      }
      ctx.restore();
    }
  }
  drawWorld(ctx, cam, t, p, active) {
    const h = this.hook;
    if (!h || !active) return;
    const hand = this.handPos(p);
    const hx = h.x - cam.x, hy = h.y - cam.y;
    ctx.save();
    ctx.strokeStyle = '#c9ccd6'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(hand.x - cam.x, hand.y - cam.y); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.translate(hx, hy);
    const a = h.state === 'attached' ? Math.atan2(h.a.y, h.a.x) : Math.atan2(h.vy || h.a.y, h.vx || h.a.x);
    ctx.rotate(a);
    ctx.fillStyle = '#e8d28a'; ctx.strokeStyle = '#5a4a28'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-4, -7); ctx.lineTo(-1, 0); ctx.lineTo(-4, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    void clamp;
  }
}
