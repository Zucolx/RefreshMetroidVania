// Titiritero (95 HP): un títere articulado con espada flota delante; látigo giratorio, picado y Cambio de hilos.
import { CONFIG, TILE } from '../config.js';
import { Kit } from './kit.js';
import { solidOverlap } from '../physics.js';
import { audio } from '../audio.js';
import { clamp, TAU, rrange } from '../util.js';

export class Puppeteer extends Kit {
  constructor() {
    super('puppeteer', {
      name: 'Titiritero',
      desc: 'Combate con su títere, látigo de hilos, picado y teletransporte de hilos.',
      pal: { skin: '#f0d6c0', skinDark: '#d8bca4', hair: '#2a1f2a', coat: '#7a4a8f', pants: '#2a2233', pantsDark: '#201a28', boots: '#1d1722', trim: '#d8cfe8', accent: '#d98cff', hat: 'tophat', glove: '#ffffff' },
    });
    this.swingTimes = [0.26, 0.26, 0.32];
    this.chargeTime = CONFIG.puppeteer.whirlTime;
    this.flavorKinds = ['rehearse'];
    this.pup = { x: 0, y: 0, vx: 0, vy: 0, mode: 'follow', t: 0, swing: null, far: 0, rot: 0, init: false, a: 0 };
    this.whirl = null;
    this.dive = null;
    this.send = null; // cambio de hilos en curso
    this.cutHit = new Map();
    this._beat = -1;
  }

  // ---------- títere ----------
  desired(p, g) {
    const f = p.facing;
    const hx = p.cx, hy = p.cy - 4;
    let tx = p.cx + f * 60, ty = p.cy - 8;
    // nunca atraviesa muros: se pega a la pared
    const dx = tx - hx, dy = ty - hy, d = Math.hypot(dx, dy) || 1;
    const hit = g.world.ray(hx, hy, dx, dy, d);
    if (hit < d) { const k = Math.max(0, hit - 10) / d; tx = hx + dx * k; ty = hy + dy * k; }
    return { x: tx, y: ty };
  }
  update(p, g, dt, active) {
    const u = this.pup;
    if (!u.init) { const d = this.desired(p, g); u.x = d.x; u.y = d.y; u.init = true; }
    u.t += dt;
    u.a += dt;
    if (u.swing) { u.swing.t += dt; if (u.swing.t >= u.swing.dur) u.swing = null; }
    if (!active) { const d = this.desired(p, g); u.x += (d.x - u.x) * Math.min(1, dt * 10); u.y += (d.y - u.y) * Math.min(1, dt * 10); return; }
    if (this.dive) this.updateDive(p, g, dt);
    else if (this.send) this.updateSend(p, g, dt);
    else if (this.whirl) this.updateWhirl(p, g, dt);
    else if (p.runMode && p.runMode.kind === 'threads') this.updateRun(p, g, dt);
    else {
      const d = this.desired(p, g);
      const ex = d.x - u.x, ey = d.y - u.y;
      const dist = Math.hypot(ex, ey);
      const wallBlocked = !g.world.los(p.cx, p.cy - 4, u.x, u.y);
      u.far = dist > 140 || wallBlocked ? u.far + dt : 0;
      if (u.far > 0.35) { u.x = d.x; u.y = d.y; u.far = 0; }
      else {
        const k = Math.min(1, dt * 14);
        u.x += ex * k; u.y += ey * k;
      }
      u.y += Math.sin(u.a * 3) * 0.25;
    }
  }
  puppetPos() { return { x: this.pup.x, y: this.pup.y }; }

  // ---------- combo del títere ----------
  swing(p, g, i, st) {
    const P = CONFIG.puppeteer;
    const f = p.facing;
    const dmg = [P.dmg1, P.dmg2, P.dmg3][i];
    const reach = i === 2 ? P.reach3 : P.reach;
    audio.sfx('slash');
    this.pup.swing = { i, t: 0, dur: st };
    p.swingAnim = { t: 0, dur: st, from: i === 1 ? -1.0 : -0.6, to: i === 1 ? -1.4 : -0.9, weaponRot: 0, armB: -1.3 };
    const info = { kind: 'puppet', melee: true, dmg, knock: i === 2 ? 340 : 150, dir: f, mana: 0.5, canParry: true, hitstop: 0.04 };
    const kit = this;
    // alcance recortado contra muros
    const u = this.pup;
    const ray = g.world.ray(u.x, u.y, f, 0, reach);
    const w = Math.max(24, Math.min(reach, ray));
    g.addHitbox({
      owner: p, shape: 'rect', w, h: i === 1 ? 54 : 40, delay: 0.07, life: 0.13, info, cut: true,
      atFn: () => ({ x: kit.pup.x + f * w / 2, y: kit.pup.y + (i === 1 ? -4 : 0) }),
    });
    g.fx.slash(u.x + f * 8, u.y, w * 0.6, i === 1 ? (f > 0 ? 1.0 : Math.PI - 1.0) : (f > 0 ? -0.9 : Math.PI + 0.9), i === 1 ? (f > 0 ? -1.0 : Math.PI + 1.0) : (f > 0 ? 0.9 : Math.PI - 0.9), 0.18, '#e8c6ff', 4);
  }

  // ---------- látigo giratorio (mantener) ----------
  chargeFire(p, g) {
    const P = CONFIG.puppeteer;
    // el radio se acorta contra muros
    let r = P.whirlRadius;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1], [0.7, -0.7], [-0.7, -0.7]]) r = Math.min(r, g.world.ray(p.cx, p.cy - 4, dx, dy, P.whirlRadius));
    r = Math.max(46, r);
    this.whirl = { t: 0, dur: 0.45, r, a0: p.facing > 0 ? 0 : Math.PI };
    p.atkLock = 0.45;
    audio.sfx('whoosh');
    g.addHitbox({ owner: p, shape: 'circle', r, ox: 0, oy: -4, delay: 0, life: 0.45, info: { kind: 'whip', melee: true, dmg: P.whirlDamage, knock: 380, from: null, radial: true, hitstop: 0.05 }, cut: true });
    p.swingAnim = { t: 0, dur: 0.45, from: -1.2, to: 4.8, weaponRot: 0, armB: -2 };
  }
  updateWhirl(p, g, dt) {
    const w = this.whirl, u = this.pup;
    w.t += dt;
    const a = w.a0 + (w.t / w.dur) * TAU * p.facing;
    u.x = p.cx + Math.cos(a) * w.r * 0.72; u.y = p.cy - 4 + Math.sin(a) * w.r * 0.72;
    u.swing = { i: 3, t: w.t, dur: w.dur };
    if (Math.random() < 0.6) g.fx.dot(p.cx + Math.cos(a) * w.r, p.cy - 4 + Math.sin(a) * w.r, 0, 0, 0.25, '#e8c6ff', 3, 0);
    if (w.t >= w.dur) { this.whirl = null; u.swing = null; }
  }

  // ---------- picado (↓ + aéreo) ----------
  airDown(p, g) {
    if (this.cd.dive > 0 || this.dive) return true;
    this.cd.dive = 0.3;
    const u = this.pup;
    u.x = p.cx; u.y = p.feetY - 12;
    this.dive = { y0: u.y };
    audio.sfx('whoosh');
    p.swingAnim = { t: 0, dur: 0.3, from: 1.4, to: 1.5, weaponRot: 0, armB: 1.4 };
    return true;
  }
  updateDive(p, g, dt) {
    const P = CONFIG.puppeteer;
    const u = this.pup, d = this.dive;
    const step = P.diveSpeed * dt;
    const n = Math.max(1, Math.ceil(step / 8));
    for (let i = 0; i < n; i++) {
      u.y += step / n;
      u.x += (p.cx - u.x) * 0.3;
      const res = this.diveContact(p, g, u);
      if (res) { this.dive = null; this.finishDive(p, g, res); return; }
      if (u.y - d.y0 > P.diveReach) { this.dive = null; g.fx.line(p.cx, p.cy, u.x, u.y, 0.15, '#e8c6ff', 2); return; }
    }
    if (Math.random() < 0.8) g.fx.dot(u.x, u.y - 8, rrange(-10, 10), -40, 0.25, '#e8c6ff', 3, 0);
  }
  diveContact(p, g, u) {
    for (const e of g.enemies) {
      if (e.dead || e.untargetable) continue;
      if (u.x > e.x - 4 && u.x < e.x + e.w + 4 && u.y + 8 > e.y && u.y < e.y + e.h) return { kind: 'enemy', e };
    }
    for (const pr of g.projectiles) {
      if (pr.dead || pr.team !== 'enemy') continue;
      if (Math.hypot(pr.x - u.x, pr.y - u.y) < pr.r + 10) return { kind: 'proj', pr };
    }
    const hz = g.world.hazardAt({ x: u.x - 4, y: u.y, w: 8, h: 10 });
    if (hz) return { kind: hz };
    const t = g.world.get(Math.floor(u.x / TILE), Math.floor((u.y + 10) / TILE));
    if (t === 1 || (t === 2 && (u.y + 10) % TILE < 12)) return { kind: 'ground' };
    return null;
  }
  finishDive(p, g, res) {
    const P = CONFIG.puppeteer;
    const u = this.pup;
    let force = P.diveBounce;
    if (res.kind === 'enemy') g.damageEnemy(res.e, P.diveDamage, { kind: 'puppet', melee: true, knock: 100, dir: p.facing, from: { x: u.x, y: u.y - 10 } });
    if (res.kind === 'proj') res.pr.die(g, true);
    if (res.kind === 'spike') {
      force *= P.diveSpike;
      g.blast(u.x, u.y, 60, 10, { kind: 'threads', knock: 300, radial: true, lift: 160 });
      g.fx.ring(u.x, u.y, 6, 60, 0.3, '#e8c6ff', 4);
    }
    g.fx.burst(u.x, u.y, 10, '#e8c6ff', 220, 0.35, 3, 0);
    p.bounce(force);
  }

  // ---------- Especial: Cambio de hilos ----------
  specialPress(p, g) {
    if (this.cd.swap > 0 || this.send) return;
    this.pressing = true;
  }
  specialHold(p, g, dt, held) {
    if (this.pressing && !this.send && held > 0.18) {
      this.pressing = false;
      this.beginSend(p, g);
    }
  }
  specialRelease(p, g, held) {
    if (this.send) { this.send.release = true; return; }
    if (this.pressing) {
      this.pressing = false;
      // pulsación corta: teletransporte al títere
      const u = this.pup;
      this.arriveAt(p, g, u.x, u.y);
    }
  }
  beginSend(p, g) {
    const a = p.aim8();
    const u = this.pup;
    this.send = { t: 0, vx: a.x * CONFIG.puppeteer.swapSpeed, vy: a.y * CONFIG.puppeteer.swapSpeed, trav: 0, wait: false, release: false };
    u.x = p.cx + a.x * 20; u.y = p.cy - 8 + a.y * 14;
    audio.sfx('hook');
  }
  updateSend(p, g, dt) {
    const s = this.send, u = this.pup, P = CONFIG.puppeteer;
    s.t += dt;
    if (!s.wait) {
      const step = Math.hypot(s.vx, s.vy) * dt;
      const n = Math.max(1, Math.ceil(step / 6));
      for (let i = 0; i < n; i++) {
        const nx = u.x + (s.vx * dt) / n, ny = u.y + (s.vy * dt) / n;
        if (g.world.solidAtPx(nx, ny)) { s.wait = true; break; }
        u.x = nx; u.y = ny; s.trav += step / n;
        if (s.trav >= P.swapReach) { s.wait = true; break; }
      }
    }
    g.fx.line(p.cx, p.cy - 20, u.x, u.y, 0.05, '#e8c6ff', 1.5);
    if ((s.wait && s.release) || s.t > 3) {
      this.send = null;
      this.arriveAt(p, g, u.x, u.y);
    }
  }
  findGap(p, g, x, y) {
    let best = null, bc = 1e9;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const cx = x + dx * (TILE / 2), cy = y + dy * (TILE / 2);
        const cost = Math.abs(dx) * 0.7 + (dy < 0 ? -dy * 0.45 : dy * 1.2);
        if (cost >= bc) continue;
        const r = { x: cx - p.w / 2, y: cy - p.h / 2, w: p.w, h: p.h };
        if (solidOverlap(g.world, r)) continue;
        if (g.world.hazardAt({ x: r.x - 2, y: r.y, w: r.w + 4, h: r.h + 6 })) continue;
        if (!g.world.los(p.cx, p.cy, cx, cy)) continue;
        best = { x: cx, y: cy }; bc = cost;
      }
    }
    return best;
  }
  arriveAt(p, g, x, y) {
    const spot = this.findGap(p, g, x, y);
    if (!spot) { g.fx.text(p.cx, p.y - 10, 'sin hueco', '#ff9090', 0.6, 11); this.send = null; return; }
    const ox = p.cx, oy = p.cy;
    g.fx.line(ox, oy, spot.x, spot.y, 0.3, '#e8c6ff', 3);
    g.fx.burst(ox, oy, 10, '#e8c6ff', 200, 0.4, 3, 0);
    p.setCenter(spot.x, spot.y);
    p.snap();
    p.vy = 0; p.vx *= 0.3;
    p.inv = Math.max(p.inv, 0.4);
    // al llegar: explosión de hilos (12 daño / 50 px)
    g.blast(p.cx, p.cy, CONFIG.puppeteer.swapRadius, CONFIG.puppeteer.swapDamage, { kind: 'threads', knock: 260, radial: true });
    g.fx.ring(p.cx, p.cy, 6, 50, 0.35, '#e8c6ff', 4);
    g.fx.burst(p.cx, p.cy, 14, '#e8c6ff', 240, 0.45, 3, 0);
    audio.sfx('swap');
    this.cd.swap = CONFIG.puppeteer.swapRecharge;
    this.send = null;
    const d = this.desired(p, g);
    this.pup.x = d.x; this.pup.y = d.y;
  }
  onHurt(p, g) {
    // el daño durante el envío lo cancela sin gastar
    if (this.send) { this.send = null; const d = this.desired(p, g); this.pup.x = d.x; this.pup.y = d.y; }
  }
  specialInfo() {
    if (this.send) return { name: 'Cambio de hilos', frac: 0.5, state: this.send.wait ? 'suelta para aparecer' : 'enviando…' };
    if (this.cd.swap > 0) return { name: 'Cambio de hilos', frac: 1 - this.cd.swap / CONFIG.puppeteer.swapRecharge, state: 'recarga' };
    return { name: 'Cambio de hilos', frac: 1, state: 'toque: al títere · mantener: lanzar' };
  }

  // ---------- hilos cortantes (dash a velocidad máxima) ----------
  maxDash() { return 'threads'; }
  onRunMode(p, g, kind, on) {
    if (on && p.runMode) p.runMode.passContact = true;
    if (!on) { this.cutHit.clear(); const d = this.desired(p, g); this.pup.x = d.x; this.pup.y = d.y; }
  }
  updateRun(p, g, dt) {
    const u = this.pup;
    const f = p.facing;
    const tx = p.cx + f * 110, ty = p.cy + 4;
    u.x += (tx - u.x) * Math.min(1, dt * 12); u.y += (ty - u.y) * Math.min(1, dt * 12);
    const x0 = Math.min(p.cx, u.x) - 6, x1 = Math.max(p.cx, u.x) + 6;
    const P = CONFIG.puppeteer;
    for (const e of g.enemies) {
      if (e.dead || e.untargetable) continue;
      if (e.x < x1 && e.x + e.w > x0 && e.y < p.cy + 20 && e.y + e.h > p.cy - 24) {
        const last = this.cutHit.get(e) ?? -9;
        if (g.time - last >= 0.6) {
          this.cutHit.set(e, g.time);
          g.damageEnemy(e, P.cutDamage, { kind: 'threads', knock: 120, dir: f, stun: P.cutStun, from: { x: p.cx, y: p.cy } });
          g.fx.line(e.cx - 20, e.cy - 14, e.cx + 20, e.cy + 14, 0.25, '#e8c6ff', 3);
        }
      }
    }
    g.fx.line(p.cx, p.cy - 6, u.x, u.y, 0.05, '#e8c6ff', 1.5);
    g.fx.line(p.cx, p.cy + 6, u.x, u.y + 4, 0.05, '#e8c6ff', 1.5);
  }
  runTick() {}

  // ---------- entrada heroica ----------
  entry(p, g) {
    const P = CONFIG.puppeteer;
    p.dropIn(6, (pp, gg) => {
      gg.blast(pp.cx, pp.cy, P.entryRadius, P.entryDamage, { kind: 'heroic', knock: 400, radial: true, lift: 120 });
      gg.fx.ring(pp.cx, pp.cy, 8, P.entryRadius, 0.4, '#e8c6ff', 6);
      gg.fx.slash(pp.cx, pp.cy - 6, 70, 0, TAU, 0.3, '#e8c6ff', 6);
      audio.sfx('slash');
      this.pup.swing = { i: 3, t: 0, dur: 0.35 };
      this.pup.swing.spin = true;
    }, 240);
  }

  // ---------- idles ----------
  pickFlavor() { this.flavorDur = 5; this._beat = -1; return 'rehearse'; }
  idleBase(p, t, pose) {
    super.idleBase(p, t, pose);
    pose.arm = -0.9 + Math.sin(t * 2) * 0.05; pose.armB = 0.5;
    pose.legA = 0.06; pose.legB = -0.06;
  }
  idleFlavor(p, t, kind, k, pose) {
    const mix = (a, b) => a + (b - a) * k;
    pose.arm = mix(pose.arm, -1.3 + Math.sin(t * 5) * 0.35);
    pose.armB = mix(pose.armB, -1.1 + Math.cos(t * 5) * 0.35);
    pose.headTilt = mix(pose.headTilt, Math.sin(t * 2.5) * 0.12);
    const b = Math.floor(t / 0.55);
    if (b !== this._beat) { this._beat = b; audio.sfx('tick'); }
  }
  drawFlavor() {}

  // ---------- dibujo ----------
  drawWeapon(c) { // barra de control
    c.fillStyle = '#6b4a2c'; c.fillRect(-3, -1.5, 14, 3); c.fillRect(7, -7, 3, 14);
  }
  poseMod(p, pose) {
    if (this.send) { pose.arm = -1.6; pose.armB = -1.6; }
    if (this.whirl) { pose.armB = -2.2; }
    if (p.runMode && p.runMode.kind === 'threads') { pose.arm = -0.3; pose.armB = -0.2; }
  }
  drawWorld(ctx, cam, t, p, active) {
    const u = this.pup;
    if (!u.init) return;
    const x = u.x - cam.x, y = u.y - cam.y;
    const f = p.facing;
    const hand = { x: p.cx + f * 12 - cam.x, y: p.cy - 22 - cam.y };
    // hilos
    ctx.save();
    ctx.strokeStyle = 'rgba(235,220,255,0.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(x, y - 10); ctx.moveTo(hand.x, hand.y); ctx.lineTo(x - 6, y - 2); ctx.moveTo(hand.x, hand.y); ctx.lineTo(x + 6, y - 2); ctx.stroke();
    ctx.translate(x, y);
    const sw = u.swing;
    let facing = this.send ? Math.sign(this.send.vx) || f : f;
    ctx.scale(facing, 1);
    const flav = active && p.idle.blend > 0.5 && p.idle.kind === 'rehearse';
    const dance = flav ? Math.sin(t * 8) : 0;
    const spinA = sw && sw.i === 3 ? (sw.t / sw.dur) * TAU * 2 : 0;
    ctx.rotate(spinA);
    // cuerpo del títere
    ctx.strokeStyle = '#d9c2a0'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 4); ctx.stroke();
    ctx.fillStyle = '#e8d4b4'; ctx.beginPath(); ctx.arc(0, -11, 4.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(1.5, -12, 1.5, 1.5);
    ctx.fillStyle = '#b03a4a'; ctx.fillRect(-4, -6, 8, 8);
    // piernas
    const sway = Math.sin(u.a * 3) * 0.2 + dance * 0.5;
    ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-1, 2); ctx.lineTo(-3 + Math.sin(sway) * 5, 10); ctx.moveTo(1, 2); ctx.lineTo(3 - Math.sin(sway) * 5, 10); ctx.stroke();
    // brazo con espada
    let ang = 0.5 + Math.sin(u.a * 2.4) * 0.15;
    if (sw && sw.i < 3) { const k = sw.t / sw.dur; ang = sw.i === 1 ? 1.2 - k * 2.4 : sw.i === 0 ? -1.4 + k * 2.4 : -0.1; }
    if (this.dive) ang = 1.57;
    ctx.save(); ctx.translate(2, -4); ctx.rotate(ang);
    ctx.strokeStyle = '#e8d4b4'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(7, 0); ctx.stroke();
    ctx.fillStyle = '#e8eef7'; ctx.fillRect(7, -1, (sw && sw.i === 2) ? 26 : 18, 2);
    ctx.fillStyle = '#ffd25a'; ctx.fillRect(6, -3, 2, 6);
    ctx.restore();
    ctx.restore();
    if (this.send && this.send.wait) { ctx.save(); ctx.strokeStyle = '#e8c6ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 14 + Math.sin(t * 10) * 2, 0, TAU); ctx.stroke(); ctx.restore(); }
    void clamp;
  }
}
