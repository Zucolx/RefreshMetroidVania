// Maga (85 HP): chispas, mariposas, corriente de aire, planeo, ráfaga de viento y el Hada benigna.
import { CONFIG } from '../config.js';
import { Kit } from './kit.js';
import { Projectile } from '../projectiles.js';
import { audio } from '../audio.js';
import { clamp, TAU, rrange, snap8 } from '../util.js';

class Fairy {
  constructor(kit, p) {
    this.kit = kit;
    this.x = p.cx; this.y = p.cy - 30;
    this.t = CONFIG.mage.fairyTime;
    this.hp = CONFIG.mage.fairyHp;
    this.alive = true;
    this.a = 0;
    this.shot = 0.4;
    this.call = 0.5;
    this.shotDown = false;
  }
  hit(g, dmg) {
    this.hp -= dmg;
    g.fx.burst(this.x, this.y, 6, '#ffd6f5', 140, 0.3, 2.5, 0);
    g.fx.text(this.x, this.y - 10, `-${Math.round(dmg)}`, '#ffd6f5', 0.5, 11);
    if (this.hp <= 0) { this.alive = false; this.shotDown = true; g.fx.burst(this.x, this.y, 14, '#ffb4ea', 220, 0.6, 3, 100); audio.sfx('kill'); }
  }
}

export class Mage extends Kit {
  constructor() {
    super('mage', {
      name: 'Maga',
      desc: 'Chispas, mariposas, planeo y el Hada benigna que provoca y dispara.',
      pal: { skin: '#f3d2b4', skinDark: '#d9b494', hair: '#b04a9a', coat: '#6b4fb8', pants: '#4a3a84', pantsDark: '#3a2c6a', boots: '#2a1f4a', trim: '#e8d27a', accent: '#c79bff', hat: 'witch', glove: '#f3d2b4', skirt: true },
    });
    this.swingTimes = [0.2, 0.2, 0.28];
    this.chargeTime = CONFIG.mage.butterflyTime;
    this.flavorKinds = ['grimoire', 'spark'];
    this.fairy = null;
    this.trail = []; // mariposas orbitando
    this.trailT = 0;
    this.gustCd = 0;
    this._beat = -1;
  }

  // ---------- ciclo ----------
  update(p, g, dt, active) {
    // hada: sigue viva aunque la maga esté en reserva
    const f = this.fairy;
    if (f) {
      if (!f.alive) { this.endFairy(g, f.shotDown ? CONFIG.mage.fairyDownRecharge : CONFIG.mage.fairyRecharge); }
      else {
        f.t -= dt;
        f.a += dt * 2.2;
        const tx = p.cx + Math.cos(f.a) * 38, ty = p.cy - 34 + Math.sin(f.a * 1.7) * 14;
        f.x += (tx - f.x) * Math.min(1, dt * 7); f.y += (ty - f.y) * Math.min(1, dt * 7);
        f.call -= dt; f.shot -= dt;
        if (f.call <= 0) { f.call = CONFIG.mage.fairyCall; this.provoke(g, f); }
        if (f.shot <= 0) this.fairyShoot(g, f);
        if (f.t <= 0) this.endFairy(g, CONFIG.mage.fairyRecharge);
      }
    }
    // mariposas del rastro
    if (this.trail.length) this.updateTrail(p, g, dt, active);
  }
  endFairy(g, recharge) {
    if (this.fairy) g.fx.burst(this.fairy.x, this.fairy.y, 10, '#ffd6f5', 160, 0.5, 3, 0);
    this.fairy = null;
    if (g.fairy && !g.fairy.alive || g.fairy === this.fairy) g.fairy = null;
    g.fairy = null;
    this.cd.fairy = recharge;
    this.rechargeMax = recharge;
  }
  provoke(g, f) {
    let n = 0;
    for (const e of g.enemies) {
      if (e.dead || e.untargetable || e.ghost || e.morph) continue;
      if (Math.hypot(e.cx - f.x, e.cy - f.y) < 300 && e.provokeBy) { e.provokeBy(f, 3); n++; }
    }
    if (n) g.fx.ring(f.x, f.y, 4, 40, 0.3, '#ff9ad8', 2);
  }
  fairyShoot(g, f) {
    const e = g.nearestEnemy(f.x, f.y, 330, { los: true, pred: (x) => !x.morph });
    if (!e) { f.shot = 0.2; return; }
    f.shot = 0.7;
    const a = Math.atan2(e.cy - f.y, e.cx - f.x);
    g.projectiles.push(new Projectile({
      x: f.x, y: f.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, r: 6, team: 'player', kind: 'fairy', dmg: CONFIG.mage.fairyDamage,
      life: 0.9, color: '#ffd6f5', shape: 'star', magic: true, knock: 120, owner: null,
    }));
    audio.sfx('magic');
  }

  cancel() { this.chargeAim = null; }
  onSwitchOut(p, g) { /* el hada sigue */ }

  // ---------- chispas ----------
  swing(p, g, i, st) {
    const M = CONFIG.mage;
    const a = p.aim8();
    // solo ↓ (sin horizontal) en suelo es corriente de aire
    if (a.x === 0 && a.y > 0 && p.onGround) { this.gust(p, g); p.atkLock = 0.3; return; }
    const dmg = [M.sparkDmg1, M.sparkDmg2, M.sparkDmg3][i];
    const col = ['#8fc4ff', '#b88fff', '#ffffff'][i];
    const l = Math.hypot(a.x, a.y) || 1;
    const dx = a.x / l, dy = a.y / l;
    if (a.x) p.facing = a.x > 0 ? 1 : -1;
    const kit = this;
    const pr = new Projectile({
      x: p.cx + dx * 16, y: p.cy - 6 + dy * 14, vx: dx * M.sparkSpeed, vy: dy * M.sparkSpeed, r: i === 2 ? 12 : 10,
      team: 'player', kind: 'spark', dmg, life: M.sparkRange / M.sparkSpeed, pierce: i === 2 ? 99 : 0, color: col, shape: 'orb', magic: true, knock: 110, owner: p,
    });
    pr.onUpdate = function (gg, dt) {
      // persigue a un enemigo solo si está a menos de 80 px
      const e = gg.nearestEnemy(this.x, this.y, 80, { pred: (o) => !this.hit.has(o) });
      if (e) {
        const ang = Math.atan2(e.cy - this.y, e.cx - this.x), sp = Math.hypot(this.vx, this.vy);
        this.vx += (Math.cos(ang) * sp - this.vx) * Math.min(1, dt * 10); this.vy += (Math.sin(ang) * sp - this.vy) * Math.min(1, dt * 10);
      }
      if (Math.random() < 0.6) gg.fx.dot(this.x, this.y, rrange(-20, 20), rrange(-20, 20), 0.25, col, 2.5, 0);
    };
    g.projectiles.push(pr);
    audio.sfx('magic');
    p.swingAnim = { t: 0, dur: st, from: -0.5, to: 0.3, weaponRot: 0 };
    void kit;
  }
  gust(p, g) {
    if (this.gustCd > 0) return;
    this.gustCd = 0.4;
    const M = CONFIG.mage;
    audio.sfx('whoosh');
    g.fx.ring(p.cx, p.cy, 10, M.gustRadius, 0.3, '#cfe9ff', 5);
    g.fx.burst(p.cx, p.cy, 14, '#cfe9ff', 260, 0.4, 3, 0);
    for (const e of g.enemiesNear(p.cx, p.cy, M.gustRadius)) {
      g.damageEnemy(e, M.gustDamage, { kind: 'wind', knock: 420, dir: Math.sign(e.cx - p.cx) || 1, from: { x: p.cx, y: p.cy }, radial: true });
    }
    for (const pr of g.projectiles) {
      if (pr.dead || pr.team !== 'enemy' || pr.unblockable) continue;
      if (Math.hypot(pr.x - p.cx, pr.y - p.cy) < M.gustRadius + pr.r) { pr.die(g, true); g.fx.burst(pr.x, pr.y, 6, '#cfe9ff', 150, 0.3, 2.5, 0); }
    }
    p.swingAnim = { t: 0, dur: 0.3, from: 0.2, to: 1.2, weaponRot: 0 };
  }
  tick(p, g, dt, active) {
    if (this.gustCd > 0) this.gustCd -= dt;
    super.tick(p, g, dt, active);
  }

  // ---------- mariposas (mantener) ----------
  chargeFire(p, g) {
    const M = CONFIG.mage;
    const a = p.aim8();
    const base = Math.atan2(a.y, a.x);
    const spread = (29 * Math.PI) / 180;
    audio.sfx('charged');
    for (let i = 0; i < M.butterflies; i++) {
      const ang = base + (i / (M.butterflies - 1) - 0.5) * spread;
      const bf = new Projectile({
        x: p.cx + Math.cos(base) * 14, y: p.cy - 6 + Math.sin(base) * 12, vx: Math.cos(ang) * 400, vy: Math.sin(ang) * 400, r: 8,
        team: 'player', kind: 'butterfly', dmg: M.butterflyDamage, life: 2.2, color: ['#ff9ad8', '#9ad0ff', '#ffe27a'][i % 3], shape: 'butterfly', magic: true, knock: 90, owner: p,
      });
      bf.onUpdate = function (gg, dt) {
        if (this.age > 0.25) {
          const e = gg.nearestEnemy(this.x, this.y, 460, { los: false });
          if (e) {
            const an = Math.atan2(e.cy - this.y, e.cx - this.x), sp = 430;
            this.vx += (Math.cos(an) * sp - this.vx) * Math.min(1, dt * 6); this.vy += (Math.sin(an) * sp - this.vy) * Math.min(1, dt * 6);
          }
        }
      };
      g.projectiles.push(bf);
    }
    p.swingAnim = { t: 0, dur: 0.3, from: -0.8, to: 0.3, weaponRot: 0 };
    p.atkLock = 0.3;
  }

  // ---------- planeo ----------
  glides(p, I) {
    return p.usedDouble && I.jumpH && !p.onGround;
  }

  // ---------- ráfaga de viento (↓ + aéreo) ----------
  airDown(p, g) {
    if (this.cd.lift > 0) return true;
    this.cd.lift = 0.3;
    const M = CONFIG.mage;
    const reach = M.windLiftReach;
    let target = null, kind = null;
    const fy = p.feetY;
    // enemigo o proyectil debajo (±30 px) sin suelo entre medias
    for (const e of g.enemies) {
      if (e.dead || e.untargetable) continue;
      const dy = e.y - fy;
      if (dy < -10 || dy > reach || Math.abs(e.cx - p.cx) > 30 + e.w / 2) continue;
      if (g.world.los(p.cx, fy, e.cx, e.y)) { if (!target || dy < target.dy) { target = { dy, e }; kind = 'enemy'; } }
    }
    for (const pr of g.projectiles) {
      if (pr.dead || pr.team !== 'enemy') continue;
      const dy = pr.y - fy;
      if (dy < -10 || dy > reach || Math.abs(pr.x - p.cx) > 30) continue;
      if (!target || dy < target.dy) { target = { dy, pr }; kind = 'proj'; }
    }
    const hz = p.hazardBelow(reach);
    if (hz) { const gd = p.groundDist(reach); if (kind === null || (target && (gd === null || true))) { kind = kind || 'hazard'; } }
    audio.sfx('whoosh');
    g.fx.burst(p.cx, fy + 6, 10, '#cfe9ff', 220, 0.35, 3, 0, 1.4, Math.PI / 2);
    g.fx.ring(p.cx, fy + 10, 6, 34, 0.25, '#cfe9ff', 3);
    p.swingAnim = { t: 0, dur: 0.25, from: 1.4, to: 1.5, weaponRot: 0 };
    if (!kind) return true; // solo soplo
    if (kind === 'enemy') g.damageEnemy(target.e, M.windLiftDamage, { kind: 'wind', knock: 80, dir: p.facing, from: { x: p.cx, y: fy } });
    if (kind === 'proj') { target.pr.die(g, true); g.fx.burst(target.pr.x, target.pr.y, 6, '#cfe9ff', 150, 0.3, 2.5, 0); }
    p.bounce(M.windLiftForce);
    return true;
  }

  // ---------- Hada benigna ----------
  specialPress(p, g) {
    if (this.fairy || this.cd.fairy > 0) return;
    this.fairy = new Fairy(this, p);
    g.fairy = this.fairy;
    audio.sfx('pickup');
    g.fx.burst(p.cx, p.cy - 20, 16, '#ffd6f5', 220, 0.6, 3, 0);
    g.fx.ring(p.cx, p.cy - 20, 4, 40, 0.4, '#ffd6f5', 3);
  }
  specialInfo() {
    if (this.fairy) return { name: 'Hada benigna', frac: this.fairy.t / CONFIG.mage.fairyTime, state: `activa · ${this.fairy.t.toFixed(0)}s · ${Math.ceil(this.fairy.hp)} HP` };
    if (this.cd.fairy > 0) return { name: 'Hada benigna', frac: 1 - this.cd.fairy / (this.rechargeMax || 5), state: 'recarga' };
    return { name: 'Hada benigna', frac: 1, state: 'listo' };
  }

  // ---------- rastro de mariposas (dash a velocidad máxima) ----------
  maxDash() { return 'trail'; }
  onRunMode(p, g, kind, on) {
    if (on) { this.trailT = 0; return; }
    // al dejar de correr, las mariposas atacan al enemigo más cercano < 520 px
    for (const b of this.trail) {
      const e = g.nearestEnemy(p.cx, p.cy, 520);
      const x = p.cx + Math.cos(b.a) * b.r, y = p.cy - 10 + Math.sin(b.a) * b.r * 0.6;
      const ang = e ? Math.atan2(e.cy - y, e.cx - x) : rrange(0, TAU);
      const bf = new Projectile({
        x, y, vx: Math.cos(ang) * 420, vy: Math.sin(ang) * 420, r: 8, team: 'player', kind: 'butterfly', dmg: CONFIG.mage.trailDamage, life: e ? 1.6 : 0.3,
        color: '#ff9ad8', shape: 'butterfly', magic: true, knock: 100, owner: p,
      });
      bf.onUpdate = function (gg, dt) {
        const t = gg.nearestEnemy(this.x, this.y, 520);
        if (t) { const an = Math.atan2(t.cy - this.y, t.cx - this.x); this.vx += (Math.cos(an) * 460 - this.vx) * Math.min(1, dt * 7); this.vy += (Math.sin(an) * 460 - this.vy) * Math.min(1, dt * 7); }
      };
      g.projectiles.push(bf);
    }
    this.trail.length = 0;
  }
  runTick(p, g, dt, rm) {
    this.trailT -= dt;
    if (this.trailT <= 0 && this.trail.length < CONFIG.mage.trailMax) {
      this.trailT = CONFIG.mage.trailEvery;
      this.trail.push({ a: rrange(0, TAU), r: 26 + this.trail.length * 3, life: 99, w: rrange(0, TAU) });
    }
  }
  updateTrail(p, g, dt, active) {
    for (const b of this.trail) b.a += dt * 3.2;
    // cada una para un proyectil enemigo
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const b = this.trail[i];
      const x = p.cx + Math.cos(b.a) * b.r, y = p.cy - 10 + Math.sin(b.a) * b.r * 0.6;
      for (const pr of g.projectiles) {
        if (pr.dead || pr.team !== 'enemy' || pr.unblockable) continue;
        if (Math.hypot(pr.x - x, pr.y - y) < pr.r + 10) {
          pr.die(g, true); this.trail.splice(i, 1);
          g.fx.burst(x, y, 8, '#ff9ad8', 160, 0.3, 2.5, 0);
          break;
        }
      }
    }
    if (!p.runMode && active) this.onRunMode(p, g, 'trail', false);
  }

  // ---------- entrada heroica ----------
  entry(p, g) {
    const x = p.cx, y = p.feetY;
    audio.sfx('whoosh');
    g.addZone({ kind: 'tornado', x, y, r: 40, life: 0.45, onDraw: (c, z) => this.drawTornado(c, z, 1) });
    g.after(0.45, (gg) => {
      for (const dir of [-1, 1]) {
        const pr = new Projectile({
          x, y: y - 30, vx: dir * 360, vy: 0, r: 26, team: 'player', kind: 'heroic', dmg: 10, life: 0.9, pierce: 99, color: '#cfe9ff', shape: 'wave', knock: 460, owner: p, noWorld: false,
        });
        pr.onUpdate = (g2) => { g2.fx.dot(pr.x, pr.y + rrange(-30, 20), -dir * 40, rrange(-30, 30), 0.3, '#cfe9ff', 3, 0); };
        pr.info = { kind: 'heroic', dmg: 10, knock: 460, dir, lift: 200, from: { x, y }, radial: false };
        gg.projectiles.push(pr);
      }
      gg.fx.burst(x, y - 20, 18, '#cfe9ff', 320, 0.5, 3, 0);
      audio.sfx('boom');
    });
  }
  drawTornado(c, z, k) {
    const a = 1 - z.age / z.max;
    c.save(); c.globalAlpha = 0.7 * a;
    for (let i = 0; i < 9; i++) {
      const yy = -i * 9, w = 10 + i * 3.4, ph = z.age * 14 + i * 0.9;
      c.strokeStyle = i % 2 ? '#cfe9ff' : '#ffffff'; c.lineWidth = 3;
      c.beginPath(); c.ellipse(Math.sin(ph) * 3, yy, w, 4, 0, 0, TAU); c.stroke();
    }
    c.restore();
  }

  // ---------- idles ----------
  pickFlavor() {
    const k = super.pickFlavor();
    this.flavorDur = k === 'grimoire' ? 5.5 : 4.5;
    this._beat = -1;
    return k;
  }
  idleBase(p, t, pose) {
    super.idleBase(p, t, pose);
    pose.arm = 0.5 + Math.sin(t * 2.2) * 0.04;
    pose.legA = 0.05; pose.legB = -0.05;
  }
  idleFlavor(p, t, kind, k, pose) {
    const mix = (a, b) => a + (b - a) * k;
    if (kind === 'grimoire') {
      pose.arm = mix(pose.arm, 0.9); pose.armB = mix(pose.armB, 0.7);
      pose.headTilt = mix(pose.headTilt, 0.3);
      const b = Math.floor(t / 1.1);
      if (b !== this._beat) { this._beat = b; audio.sfx('page'); }
    } else {
      pose.arm = mix(pose.arm, -0.2 + Math.sin(t * 3) * 0.15); pose.armB = mix(pose.armB, 0.4);
      pose.headTilt = mix(pose.headTilt, 0.2);
      const b = Math.floor(t / 0.8);
      if (b !== this._beat) { this._beat = b; audio.sfx('tick'); }
    }
  }
  drawFlavor(ctx, p, pose, kind, k, t) {
    ctx.save(); ctx.globalAlpha *= k;
    if (kind === 'grimoire') {
      ctx.translate(14, -26);
      ctx.fillStyle = '#6b3a2c'; ctx.fillRect(-9, -7, 18, 14);
      ctx.fillStyle = '#f2e6c2'; ctx.fillRect(-8, -6, 7.5, 12); ctx.fillRect(0.5, -6, 7.5, 12);
      const fl = (t * 0.9) % 1;
      ctx.fillStyle = '#e0d2a8'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(8 - fl * 16, -10 - Math.sin(fl * Math.PI) * 6); ctx.lineTo(8 - fl * 16, 4); ctx.lineTo(0, 6); ctx.fill();
      ctx.fillStyle = '#c79bff'; for (let i = 0; i < 3; i++) { ctx.globalAlpha = k * (0.4 + 0.4 * Math.sin(t * 4 + i)); ctx.fillRect(-6 + i * 3, -14 - i * 3 - (t * 8) % 6, 2, 2); }
    } else {
      const sx = 18 + Math.sin(t * 3) * 6, sy = -30 + Math.cos(t * 4.4) * 5;
      ctx.fillStyle = 'rgba(199,155,255,0.35)'; ctx.beginPath(); ctx.arc(sx, sy, 8, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(sx, sy, 3.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- dibujo ----------
  drawWeapon(c, p, pose) {
    // bastón con orbe: la pose lo mantiene casi vertical
    c.fillStyle = '#7a5030'; c.fillRect(-14, -1.8, 44, 3.6);
    c.fillStyle = '#c79bff'; c.beginPath(); c.arc(32, 0, 5.5, 0, TAU); c.fill();
    c.fillStyle = 'rgba(199,155,255,0.3)'; c.beginPath(); c.arc(32, 0, 10 + Math.sin(performance.now() / 200) * 1.2, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(30.5, -1.5, 1.8, 0, TAU); c.fill();
  }
  poseMod(p, pose) {
    if (p.swingAnim) pose.weaponRot = -pose.arm - Math.PI / 2 + 0.4;
    else if (this.idleSpark) pose.weaponRot = 0;
    else pose.weaponRot = -pose.arm - Math.PI / 2 + 0.25;
  }
  drawWorld(ctx, cam, t, p, active) {
    const f = this.fairy;
    if (f && f.alive) this.drawFairy(ctx, cam, t, f);
    if (this.trail.length) this.drawTrail(ctx, cam, t, p);
  }
  drawFairy(ctx, cam, t, f) {
    const x = f.x - cam.x, y = f.y - cam.y;
    ctx.save(); ctx.translate(x, y);
    const fl = Math.sin(t * 40);
    ctx.fillStyle = 'rgba(255,214,245,0.25)'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.ellipse(-5, -3, 7, 3 + fl * 2, -0.6, 0, TAU); ctx.ellipse(5, -3, 7, 3 - fl * 2, 0.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffc3ee'; ctx.beginPath(); ctx.arc(0, 0, 4.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, -2, 2.2, 0, TAU); ctx.fill();
    // barra de vida
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-10, 10, 20, 3);
    ctx.fillStyle = '#ff9ad8'; ctx.fillRect(-10, 10, 20 * clamp(f.hp / CONFIG.mage.fairyHp, 0, 1), 3);
    ctx.restore();
  }
  drawTrail(ctx, cam, t, p) {
    for (const b of this.trail) {
      const bx = p.cx + Math.cos(b.a) * b.r - cam.x, by = p.cy - 10 + Math.sin(b.a) * b.r * 0.6 - cam.y;
      const w = Math.abs(Math.sin(t * 20 + b.w));
      ctx.fillStyle = '#ff9ad8'; ctx.save(); ctx.translate(bx, by); ctx.scale(1, 0.4 + w * 0.6);
      ctx.beginPath(); ctx.ellipse(-3, 0, 5, 4, 0, 0, TAU); ctx.ellipse(3, 0, 5, 4, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
  }
}
void snap8;
