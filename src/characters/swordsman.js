// Espadachín (100 HP): combo ×3 de espada, media luna, parry, pogo y Escudo estelar.
import { CONFIG } from '../config.js';
import { Kit } from './kit.js';
import { Projectile } from '../projectiles.js';
import { audio } from '../audio.js';
import { clamp, TAU, rrange } from '../util.js';

export class Swordsman extends Kit {
  constructor() {
    super('swordsman', {
      name: 'Espadachín',
      desc: 'Combo de espada, media luna, parry, pogo y Escudo estelar.',
      pal: { skin: '#f0c8a0', skinDark: '#d9ac84', hair: '#4a3a2a', coat: '#3a6ea5', pants: '#2c3e5a', pantsDark: '#222f46', boots: '#4a2f1d', trim: '#c9d2e0', accent: '#ffd25a', hat: 'helm', glove: '#8a6a42' },
    });
    this.swingTimes = [0.2, 0.2, 0.3];
    this.chargeTime = CONFIG.sword.moonTime;
    this.flavorKinds = ['sharpen', 'ocarina'];
    this.cover = false;
    this.coverT = 0; // tiempo de escudo restante
    this.holdT = 0;
    this.shieldOut = null; // proyectil en vuelo
    this.aim = { x: 1, y: 0 };
    this.pogoT = 0;
    this.noteN = 0;
  }

  update(p, g, dt, active) {
    if (this.pogoT > 0) {
      this.pogoT -= dt;
      if (active && !p.onGround && p.vy > -200) {
        const hz = p.hazardBelow(34);
        if (hz) { this.pogoBounce(p, g, hz); this.pogoT = 0; }
      }
    }
    if (this.shieldOut && this.shieldOut.dead) this.shieldOut = null;
    if (!active && this.cover) this.dropCover(p, g, 0);
    if (!this.cover && this.cd.shieldCover === undefined) this.cd.shieldCover = 0;
  }
  cancel(p, g) {
    if (this.cover) this.dropCover(p, g, 0.2);
  }
  onSwitchOut(p, g) { if (this.cover) this.dropCover(p, g, 0); }

  // ---------- combo ----------
  swing(p, g, i, st) {
    const S = CONFIG.sword;
    const f = p.facing;
    const dmg = [S.dmg1, S.dmg2, S.dmg3][i];
    audio.sfx('slash');
    const info = { kind: 'sword', melee: true, dmg, knock: S.push + (i === 2 ? 60 : 0), dir: f, mana: S.mana, hitstop: S.hitstop, canParry: true, stun: 0 };
    const reach = S.reach;
    if (i === 0) p.swingAnim = { t: 0, dur: st, from: -2.3, to: 0.9, weaponRot: 0.2 };
    else if (i === 1) p.swingAnim = { t: 0, dur: st, from: 1.3, to: -1.7, weaponRot: -0.1 };
    else p.swingAnim = { t: 0, dur: st, from: -1.8, to: 4.5, weaponRot: 0 };
    const onHit = (e, res) => {
      if (res.hit && !p.onGround && p.vy > 0 && !res.parried) { p.vy = -300; p.airJumps = Math.max(p.airJumps, 1); }
      g.fx.slash(p.cx + f * 6, p.cy - 4, 34, f > 0 ? -1.0 : Math.PI + 1.0, f > 0 ? 0.9 : Math.PI - 0.9, 0.12, '#ffffff', 5);
    };
    if (i < 2) {
      g.addHitbox({ owner: p, shape: 'rect', w: reach, h: 48, ox: reach / 2 + 6, oy: -4, delay: 0.05, life: 0.13, info, cut: true, onHit });
      g.fx.slash(p.cx + f * 6, p.cy - 4, 40, i === 0 ? (f > 0 ? -1.7 : Math.PI + 1.7) : (f > 0 ? 1.2 : Math.PI - 1.2), i === 0 ? (f > 0 ? 0.7 : Math.PI - 0.7) : (f > 0 ? -1.4 : Math.PI + 1.4), 0.2, '#cfe6ff', 6);
    } else {
      // giro 360°: ambos lados
      g.addHitbox({ owner: p, shape: 'circle', r: reach + 8, ox: 0, oy: -4, delay: 0.06, life: 0.16, info: { ...info, radial: true }, cut: true, onHit });
      g.fx.ring(p.cx, p.cy - 4, 20, reach + 12, 0.22, '#cfe6ff', 6);
    }
    p.vx += f * 40;
  }

  // ---------- media luna ----------
  chargeFire(p, g) {
    const S = CONFIG.sword;
    const f = p.facing;
    audio.sfx('charged');
    const pr = new Projectile({
      x: p.cx + f * 22, y: p.cy - 4, vx: f * S.moonSpeed, vy: 0, r: 20, team: 'player', kind: 'moon', dmg: S.moonDamage,
      life: S.moonRange / S.moonSpeed, pierce: 99, color: '#bfe3ff', shape: 'crescent', knock: 380, mana: 0.5, owner: p,
      info: null,
      onUpdate(gg) {
        for (const o of gg.projectiles) {
          if (o.team === 'enemy' && !o.dead && o.cut && !o.sonic && Math.hypot(o.x - this.x, o.y - this.y) < this.r + o.r) { o.die(gg); gg.fx.burst(o.x, o.y, 6, '#fff', 150, 0.3, 2.5, 0); }
        }
        if (Math.random() < 0.6) gg.fx.dot(this.x - Math.sign(this.vx) * 10, this.y + rrange(-14, 14), 0, 0, 0.3, '#bfe3ff', 3, 0);
      },
    });
    g.projectiles.push(pr);
    p.swingAnim = { t: 0, dur: 0.3, from: -2.2, to: 0.6, weaponRot: 0.1 };
    g.fx.slash(p.cx + f * 10, p.cy - 4, 46, f > 0 ? -1.2 : Math.PI + 1.2, f > 0 ? 1.1 : Math.PI - 1.1, 0.25, '#bfe3ff', 8);
    p.atkLock = 0.3;
  }

  // ---------- pogo ----------
  airDown(p, g) {
    if (this.cd.pogo > 0 || this.cover) return true;
    this.cd.pogo = 0.2;
    const S = CONFIG.sword;
    audio.sfx('slash');
    p.swingAnim = { t: 0, dur: 0.22, from: 1.5, to: 1.57, weaponRot: Math.PI / 2 - 0.2 };
    p.actionT = 0;
    this.pogoT = 0.16;
    g.addHitbox({
      owner: p, shape: 'rect', w: 36, h: 40, ox: 0, oy: p.h / 2 + 8, delay: 0, life: 0.14,
      info: { kind: 'pogo', melee: true, dmg: S.pogoDamage, knock: 120, dir: p.facing, mana: 0.3, canParry: false, hitstop: 0.04, lift: 0 },
      cut: true, flipX: false,
      onHit: (e, res) => { if (res.hit) this.pogoBounce(p, g, null); },
      onCut: () => this.pogoBounce(p, g, null),
    });
    return true;
  }
  pogoBounce(p, g, hz) {
    p.bounce(CONFIG.sword.pogoForce);
    g.fx.burst(p.cx, p.feetY, 8, '#ffffff', 200, 0.3, 3, 0, 1.6, Math.PI / 2);
    this.pogoT = 0;
    if (hz) g.fx.text(p.cx, p.feetY, hz === 'lava' ? '¡rebote!' : '¡rebote!', '#fff', 0.5, 11);
  }

  // ---------- Especial: Escudo estelar ----------
  specialPress(p, g) {
    if (this.shieldOut || this.cd.shield > 0) return;
    this.cover = true;
    this.holdT = 0;
    this.coverT = CONFIG.sword.shieldHold;
    audio.sfx('shield');
  }
  specialHold(p, g, dt, held) {
    if (!this.cover) return;
    this.holdT += dt;
    this.coverT -= dt;
    const a = p.aim8();
    this.aim = a;
    if (a.x) p.facing = a.x > 0 ? 1 : -1;
    p.atkLock = Math.max(p.atkLock, 0.02);
    if (this.coverT <= 0) this.dropCover(p, g, CONFIG.sword.shieldRecharge);
  }
  specialRelease(p, g, held) {
    if (!this.cover) return;
    const a = p.aim8();
    if (this.holdT >= CONFIG.sword.shieldThrowMin) this.throwShield(p, g, a);
    this.dropCover(p, g, this.holdT >= CONFIG.sword.shieldThrowMin ? 0 : 0.15);
  }
  dropCover(p, g, cd) {
    this.cover = false;
    this.cd.shield = Math.max(this.cd.shield || 0, cd);
  }
  speedMul() { return this.cover ? 0.5 : 1; }
  blocksAttack() { return this.cover; }
  lockFacing() { return false; }
  blockHit(p, g, src) {
    if (!this.cover || src.hazard) return null;
    const sx = src.x ?? p.cx - p.facing, sy = src.y ?? p.cy;
    const ang = Math.atan2(sy - p.cy, sx - p.cx);
    const aim = Math.atan2(this.aim.y, this.aim.x);
    let d = Math.abs(ang - aim);
    if (d > Math.PI) d = TAU - d;
    if (d <= (75 * Math.PI) / 180) {
      this.coverT -= 0.8;
      g.fx.ring(p.cx + Math.cos(aim) * 18, p.cy + Math.sin(aim) * 18, 4, 22, 0.25, '#ffffff', 3);
      g.fx.burst(p.cx + Math.cos(aim) * 20, p.cy + Math.sin(aim) * 20, 6, '#ffe9a0', 150, 0.3, 2.5, 0);
      audio.sfx('parry');
      return 'blocked';
    }
    return null;
  }
  throwShield(p, g, a, fromEntry = false) {
    const S = CONFIG.sword;
    const sp = S.shieldSpeed;
    const l = Math.hypot(a.x, a.y) || 1;
    const kit = this;
    const pr = new Projectile({
      x: p.cx + (a.x / l) * 16, y: p.cy - 6 + (a.y / l) * 16, vx: (a.x / l) * sp, vy: (a.y / l) * sp, r: 15, team: 'player', kind: 'shieldthrow',
      dmg: S.shieldDamage, life: 8, pierce: 99, bounce: 99, color: '#9ec8ff', shape: 'shield', knock: 260, owner: p, magic: false,
      bounces: 0, leg: 'out', legDist: 0, tAge: 0,
    });
    pr.onHitEnemy = function (gg, e, res) {
      if (this.leg === 'out') {
        if (!res.hit) return;
        this.bounces++;
        this.hit.clear(); this.hit.add(e);
        gg.fx.burst(this.x, this.y, 8, '#fff', 200, 0.3, 3, 0);
        audio.sfx('parry');
        kit.shieldRetarget(this, gg, p, e);
      }
    };
    pr.onBounce = function (gg) {
      this.bounces++;
      this.legDist = 0;
      audio.sfx('bounce');
      kit.shieldRetarget(this, gg, p, null, true);
    };
    pr.onUpdate = function (gg, dt) {
      this.tAge += dt;
      const sdt = dt;
      // destruye proyectiles en vuelo (salvo los inbloqueables)
      for (const o of gg.projectiles) {
        if (o.team === 'enemy' && !o.dead && !o.unblockable && Math.hypot(o.x - this.x, o.y - this.y) < this.r + o.r + 4) { o.die(gg); gg.fx.burst(o.x, o.y, 6, '#9ec8ff', 150, 0.3, 2.5, 0); }
      }
      if (this.leg === 'out') {
        this.legDist += Math.hypot(this.vx, this.vy) * sdt;
        if (this.bounces >= S.shieldBounces || this.tAge > 3 || this.legDist > S.shieldLeg + (this.bounces === 0 ? 200 : 0)) kit.shieldReturn(this, gg);
      } else {
        const dx = p.cx - this.x, dy = p.cy - 6 - this.y, d = Math.hypot(dx, dy) || 1;
        const s = 1000;
        this.vx = (dx / d) * s; this.vy = (dy / d) * s;
        if (d < 26) { this.die(gg, true); audio.sfx('swap'); }
      }
      if (Math.random() < 0.5) gg.fx.dot(this.x, this.y, rrange(-30, 30), rrange(-30, 30), 0.3, '#9ec8ff', 2.5, 0);
    };
    this.shieldOut = pr;
    g.projectiles.push(pr);
    audio.sfx('whoosh');
    p.swingAnim = { t: 0, dur: 0.22, from: -0.5, to: 0.5, weaponRot: 0 };
    return pr;
  }
  shieldRetarget(pr, g, p, last, wall = false) {
    if (pr.bounces >= CONFIG.sword.shieldBounces) { this.shieldReturn(pr, g); return; }
    let best = null, bd = 640;
    for (const e of g.enemies) {
      if (e.dead || e.untargetable || e === last || e.ghost && false) continue;
      const d = Math.hypot(e.cx - pr.x, e.cy - pr.y);
      if (d < bd && g.world.los(pr.x, pr.y, e.cx, e.cy)) { bd = d; best = e; }
    }
    const sp = CONFIG.sword.shieldSpeed;
    pr.legDist = 0;
    if (best) {
      const a = Math.atan2(best.cy - pr.y, best.cx - pr.x);
      pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp;
    } else if (!wall) {
      // sin otro enemigo: sigue en la dirección del rebote o vuelve si no hay ninguno vivo
      const anyAlive = g.enemies.some((e) => !e.dead && !e.untargetable && e !== last);
      if (!anyAlive) { this.shieldReturn(pr, g); return; }
      pr.vx = -pr.vx; pr.vy = -pr.vy * 0.6;
    }
  }
  shieldReturn(pr, g) {
    if (pr.leg === 'ret') return;
    pr.leg = 'ret';
    pr.dmg = CONFIG.sword.shieldReturnDamage;
    pr.hit.clear();
    pr.bounce = 0;
    pr.noWorld = true;
    pr.life = 6;
  }

  specialInfo() {
    if (this.shieldOut) return { name: 'Escudo estelar', frac: 0, state: 'vuela' };
    if (this.cover) return { name: 'Escudo estelar', frac: clamp(this.coverT / CONFIG.sword.shieldHold, 0, 1), state: this.holdT >= 1 ? 'suelta = lanzar' : 'cubre' };
    if (this.cd.shield > 0) return { name: 'Escudo estelar', frac: 1 - this.cd.shield / 0.8, state: 'recarga' };
    return { name: 'Escudo estelar', frac: 1, state: 'listo' };
  }

  maxDash() { return 'skate'; }

  // ---------- entrada heroica ----------
  entry(p, g) {
    const S = CONFIG.sword;
    p.dropIn(7, (pp, gg) => {
      gg.blast(pp.cx, pp.feetY - 10, S.entryRadius, S.entryDamage, { kind: 'heroic', knock: 340, radial: true, stun: 0.8, lift: 150 });
      gg.fx.ring(pp.cx, pp.feetY, 10, S.entryRadius, 0.5, '#9ec8ff', 8);
      gg.fx.burst(pp.cx, pp.feetY, 20, '#9ec8ff', 300, 0.6, 3.5, 300, 2.2, -Math.PI / 2);
      gg.shake(8, 0.4);
      audio.sfx('boom');
      // lanza el escudo al enemigo más cercano
      let best = null, bd = 700;
      for (const e of gg.enemies) {
        if (e.dead || e.untargetable) continue;
        const d = Math.hypot(e.cx - pp.cx, e.cy - pp.cy);
        if (d < bd && gg.world.los(pp.cx, pp.cy, e.cx, e.cy)) { bd = d; best = e; }
      }
      if (best) {
        const a = Math.atan2(best.cy - pp.cy, best.cx - pp.cx);
        this.throwShield(pp, gg, { x: Math.cos(a), y: Math.sin(a) }, true);
      }
    });
  }

  // ---------- idles ----------
  pickFlavor() {
    const k = super.pickFlavor();
    this.flavorDur = k === 'ocarina' ? 6.5 : 4.5;
    this.noteN = 0; this._lastBeat = -1;
    return k;
  }
  idleBase(p, t, pose) {
    super.idleBase(p, t, pose);
    pose.arm = 0.1 + Math.sin(t * 2.2) * 0.05; // espada preparada
    pose.weaponRot = -0.55 + Math.sin(t * 1.6) * 0.06;
    pose.legA = 0.12; pose.legB = -0.1; pose.kneeA = 0.3; pose.kneeB = 0.3;
    pose.lean = 0.03 + Math.sin(t * 1.1) * 0.015;
  }
  idleFlavor(p, t, kind, k, pose) {
    const mix = (a, b) => a + (b - a) * k;
    if (kind === 'sharpen') {
      // la espada horizontal frente al pecho y la piedra de afilar yendo y viniendo
      pose.arm = mix(pose.arm, -0.1);
      pose.weaponRot = mix(pose.weaponRot, -0.2);
      pose.armB = mix(pose.armB, 0.2 + Math.sin(t * 9) * 0.35);
      pose.headTilt = mix(pose.headTilt, 0.25);
      const beat = Math.floor(t * 4.5);
      if (beat !== this._lastBeat) { this._lastBeat = beat; audio.sfx('sharpen'); }
    } else {
      pose.arm = mix(pose.arm, -2.1);
      pose.weaponRot = mix(pose.weaponRot, 1.4);
      pose.armB = mix(pose.armB, -2.0);
      pose.headTilt = mix(pose.headTilt, -0.15);
      const beat = Math.floor(t / 0.45);
      if (beat !== this._lastBeat) { this._lastBeat = beat; if (k > 0.8) audio.ocarina(this.noteN++); }
    }
  }
  drawFlavor(ctx, p, pose, kind, k, t) {
    ctx.save();
    ctx.globalAlpha *= k;
    if (kind === 'sharpen') {
      // piedra de afilar y chispas
      const x = 22 + Math.sin(t * 9) * 8;
      ctx.fillStyle = '#8c8c94'; ctx.fillRect(x - 5, -33, 10, 5);
      if (Math.sin(t * 9) > 0.6) for (let i = 0; i < 3; i++) { ctx.fillStyle = '#ffd25a'; ctx.fillRect(x + i * 3 - 3, -36 - i * 2, 2, 2); }
    } else {
      ctx.fillStyle = '#6fa8d9'; ctx.beginPath(); ctx.ellipse(12, -42, 6, 3.6, 0.3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1b3b5c'; ctx.beginPath(); ctx.arc(10, -42, 0.9, 0, TAU); ctx.arc(13, -42, 0.9, 0, TAU); ctx.fill();
      for (let i = 0; i < 2; i++) {
        const ph = (t * 0.9 + i * 0.5) % 1;
        ctx.globalAlpha = (1 - ph) * k;
        ctx.fillStyle = '#ffe9a0'; ctx.font = 'bold 14px system-ui'; ctx.fillText('♪', 18 + i * 8, -50 - ph * 30);
      }
    }
    ctx.restore();
  }

  // ---------- dibujo ----------
  drawWeapon(c, p, pose, t) {
    if (this.cover) return; // con el escudo en alto no hay espada
    // espada apuntando a +x desde la mano
    c.fillStyle = '#6b4a2c'; c.fillRect(-4, -2, 8, 4);
    c.fillStyle = '#ffd25a'; c.fillRect(4, -6, 3.5, 12);
    c.fillStyle = '#e8eef7'; c.beginPath(); c.moveTo(7, -2.4); c.lineTo(34, -1.4); c.lineTo(38, 0); c.lineTo(34, 1.4); c.lineTo(7, 2.4); c.closePath(); c.fill();
    c.fillStyle = 'rgba(120,140,170,0.6)'; c.fillRect(8, -0.4, 26, 0.9);
  }
  drawUnder(ctx, p) {
    if (p.runMode && p.runMode.kind === 'skate') { // patineta
      ctx.fillStyle = '#7a4a2a'; ctx.beginPath(); ctx.roundRect(-18, -4, 36, 4, 2); ctx.fill();
      ctx.fillStyle = '#ffd25a'; ctx.fillRect(-14, -3, 28, 1.4);
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-11, 1, 3, 0, TAU); ctx.arc(11, 1, 3, 0, TAU); ctx.fill();
    }
  }
  drawOver(ctx, p) {
    if (this.cover) { // escudo estelar apuntado
      const a = Math.atan2(this.aim.y, this.aim.x * p.facing);
      ctx.save();
      ctx.translate(Math.cos(a) * 20, -22 + Math.sin(a) * 20);
      ctx.rotate(a);
      ctx.fillStyle = 'rgba(158,200,255,0.9)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 6, 18, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); for (let i = 0; i < 10; i++) { const aa = (i / 10) * TAU - Math.PI / 2, rr = i % 2 ? 2 : 5; ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } ctx.closePath(); ctx.fill();
      ctx.restore();
      // cono de cobertura ±75°
      ctx.save(); ctx.globalAlpha *= 0.12; ctx.fillStyle = '#9ec8ff';
      ctx.beginPath(); ctx.moveTo(0, -22); ctx.arc(0, -22, 46, a - 1.3, a + 1.3); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  poseMod(p, pose) {
    if (this.cover) {
      const a = Math.atan2(this.aim.y, this.aim.x * p.facing);
      pose.arm = a; pose.weaponRot = 0;
      pose.lean = 0.1;
    }
  }
}
