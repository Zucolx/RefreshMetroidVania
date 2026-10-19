// Relojero (85 HP): llave de cuerda con eco temporal, burbuja de tiempo, aguja y Marca y retroceso.
import { CONFIG, TILE } from '../config.js';
import { Kit } from './kit.js';
import { solidOverlap } from '../physics.js';
import { T } from '../world.js';
import { audio } from '../audio.js';
import { TAU } from '../util.js';

export class Clockmaker extends Kit {
  constructor() {
    super('clockmaker', {
      name: 'Relojero',
      desc: 'Llave con eco temporal, burbuja de tiempo, aguja y retroceso en el tiempo.',
      pal: { skin: '#e8c8a8', skinDark: '#caa888', hair: '#5a3a2a', coat: '#8a6a3a', pants: '#3a3a4a', pantsDark: '#2c2c3a', boots: '#2a2018', trim: '#d8b86a', accent: '#e8c27a', hat: 'glasses', glove: '#6a4a2a', vest: '#4a3a22' },
    });
    this.swingTimes = [0.22, 0.22, 0.3];
    this.chargeTime = CONFIG.clockmaker.bubbleTime;
    this.chargeSlow = 0.6;
    this.flavorKinds = ['winding'];
    this.marks = []; // marcas temporales sobre enemigos
    this.spikeMarks = [];
    this.mark = null; // marca de retroceso del Especial
    this.stasisT = 0;
    this._beat = -1;
  }

  update(p, g, dt, active) {
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i];
      m.t -= dt;
      if (m.t <= 0) { this.marks.splice(i, 1); this.echo(p, g, m); }
      else if (m.e.dead) this.marks.splice(i, 1);
    }
    for (let i = this.spikeMarks.length - 1; i >= 0; i--) {
      const m = this.spikeMarks[i];
      m.t -= dt;
      if (m.t <= 0) {
        this.spikeMarks.splice(i, 1);
        if (active && !p.onGround && p.hazardBelow(CONFIG.clockmaker.needleReach) === 'spike') {
          p.bounce(CONFIG.clockmaker.needleForce);
          g.fx.ring(p.cx, p.feetY + 8, 4, 28, 0.3, '#e8c27a', 3);
          audio.sfx('rewind');
          if (m.n < 6) this.spikeMarks.push({ t: 0.5, n: m.n + 1 });
        }
      }
    }
    if (this.mark) {
      this.mark.t -= dt;
      if (this.mark.t <= 0) { this.mark = null; this.cd.mark = CONFIG.clockmaker.markRecharge; }
      else if (solidOverlap(g.world, { x: this.mark.x - 8, y: this.mark.y - 20, w: 16, h: 40 })) {
        this.mark = null; this.cd.mark = CONFIG.clockmaker.markRecharge;
        g.fx.text(p.cx, p.y - 10, 'marca perdida', '#ff9090', 0.8, 11);
      }
    }
  }
  onSwitchOut(p, g) { this.marks.length = 0; }

  // ---------- eco temporal ----------
  markHit(g, p, e, dmg) {
    if (!e || e.dead) return;
    this.marks = this.marks.filter((m) => m.e !== e);
    this.marks.push({ e, t: CONFIG.clockmaker.echoDelay, dmg });
  }
  echo(p, g, m) {
    const e = m.e;
    if (e.dead || Math.hypot(e.cx - p.cx, e.cy - p.cy) > 80) return;
    const info = { kind: 'echo', melee: true, dmg: m.dmg / 2, knock: 120, dir: Math.sign(e.cx - p.cx) || p.facing, from: { x: p.cx, y: p.cy }, mana: 0 };
    g.damageEnemy(e, m.dmg / 2, info);
    g.fx.ring(e.cx, e.cy - 6, 4, 30, 0.3, '#e8c27a', 3);
    audio.sfx('tick');
    // y lo que esté encima
    for (const o of g.enemies) {
      if (o === e || o.dead || o.untargetable) continue;
      if (Math.abs(o.cx - e.cx) < 36 && o.cy < e.cy && e.cy - o.cy < 90) g.damageEnemy(o, m.dmg / 2, { ...info, dir: info.dir });
    }
  }

  // ---------- combo ----------
  swing(p, g, i, st) {
    const C = CONFIG.clockmaker;
    const f = p.facing;
    const dmg = [C.dmg1, C.dmg2, C.dmg3][i];
    const reach = i === 2 ? C.reach3 : C.reach;
    audio.sfx('slash');
    if (i === 0) p.swingAnim = { t: 0, dur: st, from: -0.5, to: 0.5, weaponRot: 0 };
    else if (i === 1) p.swingAnim = { t: 0, dur: st, from: 1.0, to: -1.6, weaponRot: 0 };
    else p.swingAnim = { t: 0, dur: st, from: -2.5, to: 1.2, weaponRot: 0 };
    const info = { kind: 'wrench', melee: true, dmg, knock: C.push, dir: f, mana: 0.5, canParry: false, hitstop: 0.04, lift: i === 1 ? 160 : 0 };
    const kit = this;
    g.addHitbox({
      owner: p, shape: 'rect', w: reach + 6, h: i === 2 ? 60 : i === 1 ? 54 : 40, ox: (reach + 6) / 2 + 8, oy: i === 1 ? -10 : i === 2 ? -12 : -2, delay: 0.06, life: 0.12, info, cut: true,
      onHit: (e, res) => { if (res.hit) kit.markHit(g, p, e, dmg); },
    });
    g.fx.slash(p.cx + f * 8, p.cy - 6, reach * 0.65, i === 1 ? (f > 0 ? 1.0 : Math.PI - 1.0) : (f > 0 ? -1.2 : Math.PI + 1.2), i === 1 ? (f > 0 ? -1.2 : Math.PI + 1.2) : (f > 0 ? 1.0 : Math.PI - 1.0), 0.18, '#f0d890', 5);
  }

  // ---------- burbuja de tiempo (mantener) ----------
  chargeFire(p, g) {
    const C = CONFIG.clockmaker;
    const f = p.facing;
    const bx = p.cx + f * 64, by = p.cy - 2;
    audio.sfx('rewind');
    const kit = this;
    g.addHitbox({
      owner: p, shape: 'circle', r: 48, at: { x: bx, y: by }, delay: 0.05, life: 0.12,
      info: { kind: 'wrench', melee: true, dmg: C.bubbleDamage, knock: 260, dir: f, mana: 0.5, hitstop: 0.05 },
      cut: true, onHit: (e, res) => { if (res.hit) kit.markHit(g, p, e, C.bubbleDamage); },
    });
    g.addZone({ kind: 'bubble', x: bx, y: by, r: C.bubbleRadius, life: C.bubbleLife, slow: C.bubbleSlow });
    g.fx.ring(bx, by, 10, C.bubbleRadius, 0.35, '#9fd0ff', 5);
    p.swingAnim = { t: 0, dur: 0.3, from: -2.2, to: 1.0, weaponRot: 0 };
    p.atkLock = 0.3;
  }

  // ---------- aguja (↓ + aéreo) ----------
  airDown(p, g) {
    if (this.cd.needle > 0) return true;
    this.cd.needle = 0.3;
    const C = CONFIG.clockmaker;
    audio.sfx('tick');
    p.swingAnim = { t: 0, dur: 0.22, from: 1.5, to: 1.55, weaponRot: 0 };
    const x = p.cx, fy = p.feetY;
    for (let d = 0; d <= C.needleReach; d += 4) {
      const y = fy + d;
      // proyectil enemigo
      for (const pr of g.projectiles) {
        if (pr.dead || pr.team !== 'enemy') continue;
        if (Math.abs(pr.x - x) < pr.r + 10 && Math.abs(pr.y - y) < pr.r + 6) { pr.die(g, true); return this.needleHit(p, g, x, y, null); }
      }
      for (const e of g.enemies) {
        if (e.dead || e.untargetable) continue;
        if (x > e.x - 6 && x < e.x + e.w + 6 && y > e.y && y < e.y + e.h) {
          g.damageEnemy(e, C.needleDamage, { kind: 'wrench', melee: true, knock: 60, dir: p.facing, from: { x, y: fy } });
          return this.needleHit(p, g, x, y, null);
        }
      }
      const hz = g.world.hazardAt({ x: x - 4, y: y - 2, w: 8, h: 8 });
      if (hz) return this.needleHit(p, g, x, y, hz);
      const t = g.world.get(Math.floor(x / TILE), Math.floor(y / TILE));
      if (t === T.SOLID || (t === T.PLAT && p.vy >= 0 && y % TILE < 10)) return this.needleHit(p, g, x, y, null);
    }
    g.fx.line(x, fy, x, fy + C.needleReach, 0.12, '#e8d9a0', 2);
    return true;
  }
  needleHit(p, g, x, y, hz) {
    const C = CONFIG.clockmaker;
    g.fx.line(x, p.feetY, x, y, 0.15, '#e8d9a0', 3);
    g.fx.burst(x, y, 8, '#e8d9a0', 200, 0.3, 3, 0);
    p.bounce(C.needleForce);
    if (hz === 'spike') {
      this.spikeMarks.push({ t: 0.5, n: 1 });
      g.fx.ring(x, y, 4, 22, 0.5, '#e8c27a', 2);
    }
    return true;
  }

  // ---------- Especial: Marca y retroceso ----------
  specialPress(p, g) {
    const C = CONFIG.clockmaker;
    if (this.mark) {
      // volver al instante, quieto, 0,5 s invulnerable (no restaura vida)
      const m = this.mark;
      this.mark = null;
      this.cd.mark = C.markRecharge;
      g.fx.burst(p.cx, p.cy, 14, '#e8c27a', 220, 0.4, 3, 0);
      p.endMode();
      p.setCenter(m.x, m.y);
      p.snap();
      p.vx = 0; p.vy = 0;
      p.inv = Math.max(p.inv, C.markInvuln);
      p.dashT = 0;
      g.fx.ring(p.cx, p.cy, 6, 50, 0.4, '#e8c27a', 4);
      g.fx.burst(p.cx, p.cy, 14, '#e8c27a', 220, 0.4, 3, 0);
      audio.sfx('rewind');
      return;
    }
    if (this.cd.mark > 0) return;
    this.mark = { x: p.cx, y: p.cy, t: C.markTime };
    audio.sfx('tick');
    g.fx.ring(p.cx, p.cy, 4, 26, 0.3, '#e8c27a', 3);
  }
  specialInfo() {
    const C = CONFIG.clockmaker;
    if (this.mark) return { name: 'Marca y retroceso', frac: this.mark.t / C.markTime, state: 'pulsa para volver' };
    if (this.cd.mark > 0) return { name: 'Marca y retroceso', frac: 1 - this.cd.mark / C.markRecharge, state: 'recarga' };
    return { name: 'Marca y retroceso', frac: 1, state: 'deja una marca' };
  }

  // ---------- estela de estasis (dash a velocidad máxima) ----------
  maxDash() { return 'trail'; }
  runTick(p, g, dt) {
    this.stasisT -= dt;
    if (this.stasisT <= 0) {
      this.stasisT = 0.1;
      const C = CONFIG.clockmaker;
      g.addZone({ kind: 'stasis', x: p.cx - p.facing * 8, y: p.cy + 4, r: 30, life: C.stasisLife, slow: C.stasisSlow, slowTime: C.stasisTime });
    }
  }

  // ---------- entrada heroica ----------
  entry(p, g) {
    const C = CONFIG.clockmaker;
    const x = p.cx, y = p.cy;
    audio.sfx('rewind');
    g.addZone({ kind: 'clock', x, y, r: 48, life: 0.6, onDraw: (c, z) => this.drawSphere(c, z) });
    g.after(0.45, (gg) => {
      gg.addZone({ kind: 'slowpulse', x, y, r: C.entryRadius, life: 0.5, slow: C.entrySlow });
      for (const e of gg.enemies) {
        if (!e.dead && !e.untargetable && Math.hypot(e.cx - x, e.cy - y) < C.entryRadius) e.applySlow(C.entrySlow, 2);
      }
      gg.fx.ring(x, y, 10, C.entryRadius, 0.5, '#9fd0ff', 6);
      audio.sfx('tick');
    });
  }
  drawSphere(c, z) {
    const k = 1 - z.age / z.max;
    c.save(); c.globalAlpha = 0.85 * k;
    c.fillStyle = 'rgba(230,240,255,0.35)'; c.beginPath(); c.arc(0, 0, z.r, 0, TAU); c.fill();
    c.strokeStyle = '#e8c27a'; c.lineWidth = 4; c.stroke();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; c.beginPath(); c.moveTo(Math.cos(a) * (z.r - 8), Math.sin(a) * (z.r - 8)); c.lineTo(Math.cos(a) * (z.r - 2), Math.sin(a) * (z.r - 2)); c.stroke(); }
    c.lineWidth = 3; // manecillas hacia atrás
    c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(-z.age * 14) * z.r * 0.75, Math.sin(-z.age * 14) * z.r * 0.75); c.stroke();
    c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(-z.age * 3) * z.r * 0.5, Math.sin(-z.age * 3) * z.r * 0.5); c.stroke();
    c.restore();
  }

  // ---------- idles ----------
  pickFlavor() { this.flavorDur = 5; this._beat = -1; return 'winding'; }
  idleBase(p, t, pose) {
    super.idleBase(p, t, pose);
    pose.arm = 0.7 + Math.sin(t * 2) * 0.05;
    pose.legA = 0.1 + Math.max(0, Math.sin(t * 3)) * 0.1; pose.legB = -0.08;
  }
  idleFlavor(p, t, kind, k, pose) {
    const mix = (a, b) => a + (b - a) * k;
    pose.arm = mix(pose.arm, 0.2); pose.armB = mix(pose.armB, 0.15 + Math.sin(t * 7) * 0.25);
    pose.headTilt = mix(pose.headTilt, 0.35);
    const b = Math.floor(t * 4);
    if (b !== this._beat) { this._beat = b; audio.sfx('crank'); }
  }
  drawFlavor(ctx, p, pose, kind, k, t) {
    ctx.save(); ctx.globalAlpha *= k;
    ctx.translate(14, -24);
    ctx.fillStyle = '#e8c27a'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f6f0dc'; ctx.beginPath(); ctx.arc(0, 0, 5.4, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(t * 6) * 4, Math.sin(t * 6) * 4); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(t * 0.5) * 2.6, Math.sin(t * 0.5) * 2.6); ctx.stroke();
    ctx.fillStyle = '#e8c27a'; ctx.fillRect(-1.5, -10, 3, 3);
    ctx.restore();
  }

  // ---------- dibujo ----------
  drawWeapon(c, p, pose) { // llave de cuerda
    c.fillStyle = '#6a5030'; c.fillRect(-4, -2, 12, 4);
    c.fillStyle = '#d8b86a'; c.fillRect(8, -2, 18, 4);
    c.beginPath(); c.arc(30, 0, 7, 0, TAU); c.fill();
    c.fillStyle = '#3a3a4a'; c.beginPath(); c.arc(30, 0, 3.6, 0, TAU); c.fill();
    c.fillStyle = '#d8b86a'; c.fillRect(33, -8, 4, 5); c.fillRect(33, 3, 4, 5);
  }
  drawWorld(ctx, cam, t, p, active) {
    // esferas de reloj sobre enemigos marcados
    for (const m of this.marks) {
      const e = m.e;
      const x = e.cx - cam.x, y = e.y - 12 - cam.y;
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = 'rgba(246,240,220,0.9)'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(-m.t * 20) * 5, Math.sin(-m.t * 20) * 5); ctx.stroke();
      ctx.restore();
    }
    if (this.mark) {
      const m = this.mark;
      const x = m.x - cam.x, y = m.y - cam.y;
      ctx.save(); ctx.translate(x, y);
      ctx.globalAlpha = 0.55 + 0.2 * Math.sin(t * 6);
      ctx.fillStyle = 'rgba(232,194,122,0.25)'; ctx.beginPath(); ctx.roundRect(-11, -21, 22, 42, 8); ctx.fill();
      ctx.strokeStyle = '#e8c27a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 9, -Math.PI / 2, -Math.PI / 2 + TAU * (m.t / CONFIG.clockmaker.markTime)); ctx.stroke();
      ctx.restore();
    }
  }
}
