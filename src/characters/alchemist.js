// Alquimista (90 HP): frascos, ácido, frasco inestable y Transmutación (piel de piedra / piel etérea).
import { CONFIG, TILE } from '../config.js';
import { Kit } from './kit.js';
import { Projectile } from '../projectiles.js';
import { T } from '../world.js';
import { audio } from '../audio.js';
import { clamp, TAU, rrange } from '../util.js';

const FLASK_G = 1400;

export class Alchemist extends Kit {
  constructor() {
    super('alchemist', {
      name: 'Alquimista',
      desc: 'Frascos con arco, charcos de ácido y transmutación en piedra o etérea.',
      pal: { skin: '#e3c0a0', skinDark: '#c4a084', hair: '#2a2a2a', coat: '#3f8f5a', pants: '#3a3f4a', pantsDark: '#2d3139', boots: '#2a2018', trim: '#c9b36a', accent: '#8dff8d', hat: 'mask', glove: '#2a2a2a', skirt: true },
    });
    this.swingTimes = [0.24, 0.24, 0.3];
    this.chargeTime = CONFIG.alchemist.acidTime;
    this.chargeSlow = 0.6;
    this.flavorKinds = ['shake'];
    this.skin = null; // 'stone' | 'ether'
    this.skinT = 0;
    this.pressing = false;
    this.preview = null;
    this.vaporT = 0;
    this._beat = -1;
  }

  update(p, g, dt, active) {
    if (this.skin) {
      this.skinT -= dt;
      if (active) { p.stoneSkin = this.skin === 'stone'; p.ether = this.skin === 'ether'; p.tint = this.skin === 'ether' ? { alpha: 0.55 } : null; }
      if (this.skinT <= 0) this.endSkin(p);
    }
  }
  endSkin(p) {
    if (!this.skin) return;
    this.skin = null;
    this.cd.trans = CONFIG.alchemist.transRecharge;
    p.stoneSkin = false; p.ether = false; p.tint = null;
    p.g.fx.burst(p.cx, p.cy, 12, '#8dff8d', 180, 0.4, 3, 0);
  }
  onSwitchOut(p) { this.endSkin(p); }
  cancel() { this.preview = null; }

  // ---------- frascos ----------
  throwFlask(p, g, o) {
    const f = p.facing;
    const up = p.in.y < 0;
    const A = CONFIG.alchemist;
    const vx = f * (o.vx ?? (up ? 280 : 430));
    const vy = o.vy ?? (up ? -560 : -330);
    const kit = this;
    const pr = new Projectile({
      x: p.cx + f * 14, y: p.cy - 10, vx: vx * (o.k ?? 1), vy: vy * (o.k ?? 1), r: o.r || 7, team: 'player', kind: 'flask', dmg: 0, life: 2.5, grav: FLASK_G,
      color: o.color, shape: 'flask', owner: p, spin: 8 * f, magic: false,
    });
    pr.info = { kind: 'flask', dmg: 0, quiet: true, knock: 0, from: null };
    pr.onUpdate = function (gg) {
      for (const e of gg.projectiles) {
        if (e.team === 'enemy' && !e.dead && !e.unblockable && Math.hypot(e.x - this.x, e.y - this.y) < this.r + e.r) { e.die(gg, true); this.die(gg); return false; }
      }
      if (gg.world.hazardAt({ x: this.x - 3, y: this.y - 3, w: 6, h: 6 })) this.die(gg);
    };
    pr.onDie = function (gg) { kit.splash(gg, p, this.x, this.y, o); };
    g.projectiles.push(pr);
    return pr;
  }
  splash(g, p, x, y, o) {
    g.explosion(x, y, o.rad, o.dmg, { kind: o.acid ? 'acid' : 'flask', knock: o.big ? 240 : 160, radial: true, mana: o.mana || 0, color: o.color, noScare: true });
    g.fx.ring(x, y, 4, o.rad + 6, 0.3, o.color, 3);
    g.fx.burst(x, y, o.big ? 18 : 10, o.color, 200, 0.5, 3, 300, TAU);
    audio.sfx('glass');
    if (o.acid) this.puddle(g, x, y);
  }
  puddle(g, x, y) {
    const A = CONFIG.alchemist;
    const w = g.world;
    const fy = w.floorBelow(x, y - 6, 500);
    if (fy === null) return;
    const ty = Math.floor(fy / TILE), tx = Math.floor(x / TILE);
    const floorAt = (cx) => { const t = w.get(cx, ty); return (t === T.SOLID || t === T.PLAT) && w.get(cx, ty - 1) !== T.SOLID; };
    let l = tx, r = tx;
    while (l > 0 && floorAt(l - 1) && tx - l < 6) l--;
    while (r < w.w - 1 && floorAt(r + 1) && r - tx < 6) r++;
    const L = l * TILE, R = (r + 1) * TILE, rad = A.puddleRadius;
    const cx = R - L < rad * 2 ? (L + R) / 2 : clamp(x, L + rad, R - rad);
    const rr = Math.min(rad, (R - L) / 2 + 6);
    g.addZone({ kind: 'acid', x: cx, y: fy, r: rr, life: A.puddleTime, dps: A.puddleDps });
  }
  swing(p, g, i, st) {
    const A = CONFIG.alchemist;
    const big = i === 2;
    audio.sfx('swap');
    this.throwFlask(p, g, {
      dmg: big ? A.flask3Damage : A.flaskDamage, rad: big ? A.flask3Radius : A.flaskRadius, color: ['#8dff8d', '#6fd0ff', '#ffb36a'][i], big, mana: 0.5, r: big ? 9 : 7,
    });
    p.swingAnim = { t: 0, dur: st, from: -2.2, to: 0.5, weaponRot: 0 };
  }

  // ---------- frasco ácido (mantener) ----------
  chargeUpdate(p, g, dt) {
    const up = p.in.y < 0;
    const f = p.facing;
    const v = this.acidVel(p, up);
    const pts = [];
    let x = p.cx + f * 14, y = p.cy - 10, vx = v.vx, vy = v.vy;
    for (let t = 0; t < 1.6; t += 0.05) {
      vy += FLASK_G * 0.05; x += vx * 0.05; y += vy * 0.05;
      if (g.world.solidAtPx(x, y)) break;
      pts.push({ x, y });
    }
    this.preview = pts;
  }
  acidVel(p, up) {
    return { vx: p.facing * (up ? 300 : 520), vy: up ? -640 : -430 };
  }
  chargeFire(p, g) {
    const A = CONFIG.alchemist;
    const up = p.in.y < 0;
    const v = this.acidVel(p, up);
    this.throwFlask(p, g, { dmg: A.acidDamage, rad: A.acidRadius, color: '#9aff4a', acid: true, big: true, vx: Math.abs(v.vx), vy: v.vy, r: 9 });
    audio.sfx('swap');
    p.swingAnim = { t: 0, dur: 0.3, from: -2.4, to: 0.5, weaponRot: 0 };
    p.atkLock = 0.3;
    this.preview = null;
  }
  attackRelease() { this.preview = null; }

  // ---------- inestable (↓ + aéreo) ----------
  airDown(p, g) {
    if (this.cd.unstable > 0) return true;
    this.cd.unstable = CONFIG.alchemist.unstableGap;
    const A = CONFIG.alchemist;
    const kit = this;
    const pr = new Projectile({ x: p.cx, y: p.feetY + 2, vx: 0, vy: 520, r: 8, team: 'player', kind: 'flask', dmg: 0, life: 2, grav: 600, color: '#ff6ad8', shape: 'flask', owner: p });
    pr.info = { kind: 'flask', dmg: 0, quiet: true, knock: 0, from: null };
    pr.onUpdate = function (gg) {
      for (const e of gg.projectiles) {
        if (e.team === 'enemy' && !e.dead && !e.unblockable && Math.hypot(e.x - this.x, e.y - this.y) < this.r + e.r) { e.die(gg, true); this.die(gg); return false; }
      }
      if (gg.world.hazardAt({ x: this.x - 4, y: this.y - 4, w: 8, h: 8 })) this.die(gg);
    };
    pr.onDie = function (gg) {
      const spike = gg.world.hazardAt({ x: this.x - 6, y: this.y - 6, w: 12, h: 12 }) === 'spike';
      gg.explosion(this.x, this.y, A.unstableRadius, A.unstableDamage, { kind: 'flask', knock: 260, radial: true, lift: 160, color: '#ff6ad8', noScare: true });
      gg.fx.ring(this.x, this.y, 4, A.unstableRadius + 6, 0.3, '#ff6ad8', 4);
      gg.fx.burst(this.x, this.y, 14, '#ff6ad8', 240, 0.5, 3, 200);
      audio.sfx('explosion');
      const d = Math.hypot(p.cx - this.x, p.feetY - this.y);
      if (d < 120 && !p.onGround) {
        let boost = A.unstableBoost * (1 - 0.5 * clamp(d / 120, 0, 1));
        if (spike) boost = Math.min(A.unstableSpike, boost * 1.5);
        p.bounce(boost);
      }
      if (spike) gg.addZone({ kind: 'vapor', x: this.x, y: this.y - 6, r: 44, life: 3, dmg: 1.5, color: '#b8ff8a' });
      void kit;
    };
    g.projectiles.push(pr);
    p.swingAnim = { t: 0, dur: 0.22, from: 1.4, to: 1.5, weaponRot: 0 };
    audio.sfx('swap');
    return true;
  }

  // ---------- Especial: Transmutación ----------
  specialPress(p, g) {
    if (this.skin || this.cd.trans > 0) return;
    this.pressing = true;
  }
  specialHold(p, g, dt, held) {
    if (this.pressing && !this.skin && held >= 0.4) { this.pressing = false; this.activate(p, g, 'ether'); }
  }
  specialRelease(p, g, held) {
    if (this.pressing && !this.skin) this.activate(p, g, 'stone');
    this.pressing = false;
  }
  activate(p, g, kind) {
    this.skin = kind;
    this.skinT = CONFIG.alchemist.transTime;
    audio.sfx('shield');
    g.fx.ring(p.cx, p.cy, 6, 40, 0.4, kind === 'stone' ? '#b0b6c0' : '#7ff5e8', 4);
    g.fx.burst(p.cx, p.cy, 16, kind === 'stone' ? '#b0b6c0' : '#7ff5e8', 220, 0.5, 3, 0);
    g.fx.text(p.cx, p.y - 12, kind === 'stone' ? 'PIEL DE PIEDRA' : 'PIEL ETÉREA', kind === 'stone' ? '#d0d4dc' : '#7ff5e8', 1, 12);
  }
  damageTakenMul() { return this.skin === 'stone' ? CONFIG.alchemist.stoneDamageMul : 1; }
  speedMul() { return this.skin === 'stone' ? CONFIG.alchemist.stoneSpeed : 1; }
  specialInfo() {
    const A = CONFIG.alchemist;
    if (this.skin) return { name: 'Transmutación', frac: this.skinT / A.transTime, state: this.skin === 'stone' ? 'piedra' : 'etérea' };
    if (this.cd.trans > 0) return { name: 'Transmutación', frac: 1 - this.cd.trans / A.transRecharge, state: 'recarga' };
    return { name: 'Transmutación', frac: 1, state: 'toque: piedra · mantener: etérea' };
  }

  // ---------- vapores corrosivos (dash a velocidad máxima) ----------
  maxDash() { return 'trail'; }
  runTick(p, g, dt) {
    this.vaporT -= dt;
    if (this.vaporT <= 0) {
      this.vaporT = CONFIG.alchemist.vaporEvery;
      const A = CONFIG.alchemist;
      g.addZone({ kind: 'vapor', x: p.cx - p.facing * 6, y: p.cy + 4, r: 26, life: A.vaporLife, dmg: A.vaporDamage, color: '#b8ff8a' });
    }
  }

  // ---------- entrada heroica ----------
  entry(p, g) {
    const A = CONFIG.alchemist;
    const x = p.cx, y = p.feetY;
    p.hidden = true;
    audio.sfx('whoosh');
    const cols = ['#ff6a6a', '#6ad0ff', '#ffe27a'];
    [-80, 0, 80].forEach((off, i) => {
      g.after(0.05 + i * 0.1, (gg) => {
        const fl = new Projectile({ x: x + off, y: y - 260, vx: 0, vy: 500, r: 8, team: 'player', kind: 'flask', dmg: 0, life: 1.4, grav: 900, color: cols[i], shape: 'flask', owner: p });
        fl.info = { kind: 'flask', dmg: 0, quiet: true, knock: 0, from: null };
        fl.onDie = (g2) => {
          g2.explosion(fl.x, fl.y, A.entryRadius, A.entryDamage, { kind: 'heroic', knock: 300, radial: true, lift: 340, color: cols[i] });
          g2.fx.ring(fl.x, fl.y, 6, A.entryRadius, 0.35, cols[i], 5);
          for (const c of cols) g2.fx.smoke(fl.x + rrange(-14, 14), fl.y, 2, c.replace('#', '#') + '99', 16);
          audio.sfx('glass');
        };
        gg.projectiles.push(fl);
      });
    });
    g.after(0.6, (gg) => {
      p.hidden = false;
      for (const c of cols) gg.fx.smoke(x + rrange(-10, 10), y - 20, 4, c + 'aa', 16);
    });
  }

  // ---------- idles ----------
  pickFlavor() { this.flavorDur = 4.8; this._beat = -1; return 'shake'; }
  idleBase(p, t, pose) {
    super.idleBase(p, t, pose);
    pose.arm = 0.7 + Math.sin(t * 2) * 0.06;
    pose.legA = 0.08; pose.legB = -0.08;
  }
  idleFlavor(p, t, kind, k, pose) {
    const mix = (a, b) => a + (b - a) * k;
    pose.arm = mix(pose.arm, -2.1 + Math.sin(t * 11) * 0.18);
    pose.headTilt = mix(pose.headTilt, -0.25);
    const b = Math.floor(t * 3);
    if (b !== this._beat) { this._beat = b; audio.sfx('shake'); }
  }
  drawFlavor(ctx, p, pose, kind, k, t) {
    ctx.save(); ctx.globalAlpha *= k;
    ctx.fillStyle = 'rgba(255,255,220,0.25)'; ctx.beginPath(); ctx.arc(16, -50, 14 + Math.sin(t * 6) * 2, 0, TAU); ctx.fill();
    for (let i = 0; i < 3; i++) { const ph = (t * 1.4 + i * 0.33) % 1; ctx.globalAlpha = k * (1 - ph); ctx.fillStyle = '#b8ff8a'; ctx.beginPath(); ctx.arc(14 + i * 3, -54 - ph * 14, 2, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  // ---------- dibujo ----------
  drawWeapon(c, p, pose) {
    c.fillStyle = 'rgba(200,230,245,0.9)'; c.beginPath(); c.arc(5, 0, 6, 0, TAU); c.fill();
    c.fillStyle = this.skin === 'ether' ? '#7ff5e8' : '#8dff8d'; c.beginPath(); c.arc(5, 1.5, 4.6, 0, Math.PI); c.fill();
    c.fillStyle = '#cfe9f5'; c.fillRect(8.5, -3, 5, 3.4);
    c.fillStyle = '#7a5a3a'; c.fillRect(12.5, -3.5, 2.6, 4);
    c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.arc(3, -2, 1.6, 0, TAU); c.fill();
  }
  drawOver(ctx, p) {
    if (this.skin === 'stone') {
      ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#a0a6b2';
      ctx.beginPath(); ctx.roundRect(-9, -44, 18, 44, 6); ctx.fill();
      ctx.strokeStyle = '#6a707c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-3, -40); ctx.lineTo(1, -30); ctx.lineTo(-2, -22); ctx.stroke();
      ctx.restore();
    } else if (this.skin === 'ether') {
      ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#7ff5e8';
      ctx.beginPath(); ctx.roundRect(-10, -45, 20, 45, 8); ctx.fill();
      ctx.restore();
    }
  }
  drawWorld(ctx, cam, t, p, active) {
    if (!active || !this.preview || !p.charging) return;
    ctx.save(); ctx.fillStyle = 'rgba(160,255,80,0.9)';
    this.preview.forEach((q, i) => { if (i % 2 === 0) { ctx.beginPath(); ctx.arc(q.x - cam.x, q.y - cam.y, 2.4, 0, TAU); ctx.fill(); } });
    ctx.restore();
  }
}
