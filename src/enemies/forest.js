// Enemigos del bosque: Araña, Arañita, Arbusto-treant y hadas (la base de hada se reutiliza para el hada negra).
import { Enemy } from './base.js';
import { CONFIG, TILE } from '../config.js';
import { moveBody } from '../physics.js';
import { TAU, chance, clamp, rrange } from '../util.js';
import { audio } from '../audio.js';
import { Projectile } from '../projectiles.js';

// ---------------------------------------------------------------------
export class Spider extends Enemy {
  static def = { name: 'Araña', hp: 35, coins: [3, 6], w: 30, h: 22, contact: 10, color: '#7a5aa0', hang: true };
  init() {
    this.homeY = this.y;
    this.webT = 1.2; this.eggT = 1.5; this.fledT = 0;
    this.dropY = 0;
    this.canMorph = true;
  }
  get webbedPlayer() { return this.g.player.webbed > 0; }
  ai(g, dt) {
    const p = g.player;
    if (this.state === 'fled') {
      this.fledT -= dt;
      this.y += (this.homeY - this.h - this.y) * Math.min(1, dt * 3);
      if (this.fledT <= 0) { this.untargetable = false; this.canMorph = true; this.setState('idle'); g.fx.burst(this.cx, this.cy, 8, '#9a7ac0', 120, 0.4, 3, 0); }
      return;
    }
    const sees = this.seesPlayer(g, 430);
    // desciende por un hilo hacia la altura del jugador (máx. 120 px)
    const want = sees ? clamp(p.cy - 60 - this.homeY, 0, 120) : 0;
    this.dropY += (want - this.dropY) * Math.min(1, dt * 2.2);
    this.y = this.homeY + this.dropY;
    this.face(p.cx);
    if (!sees) return;
    this.webT -= dt; this.eggT -= dt;
    if (this.webT <= 0 && !this.webbedPlayer) {
      this.webT = 3.2;
      const a = Math.atan2(p.cy - this.cy, p.cx - this.cx);
      const pr = this.shoot(g, { x: this.cx, y: this.cy, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, r: 14, dmg: 3, life: 2, color: '#fff', shape: 'net', kind: 'enemy', cut: true, reflect: false, shieldKill: true, web: 2, spin: 4 });
      void pr;
      audio.sfx('whoosh');
    }
    if (this.eggT <= 0 && this.webbedPlayer) {
      this.eggT = 2.2;
      const dx = p.cx - this.cx, t = 0.8;
      const self = this;
      const egg = this.shoot(g, { x: this.cx, y: this.cy + 6, vx: dx / t, vy: (p.cy - this.cy) / t - 0.5 * 900 * t, r: 8, dmg: 4, life: 2.2, grav: 900, color: '#e8e2c0', shape: 'egg', kind: 'enemy', cut: true, reflect: false, shieldKill: true });
      egg.spawnOnDie = true;
      egg.onDie = function (gg, silent) {
        if (this.reflected) return;
        const count = gg.enemies.filter((e) => e instanceof Spiderling && !e.dead).length;
        if (count < 14) gg.spawnEnemy({ type: 'spiderling', x: 0, y: 0, px: this.x, py: this.y + 6, temp: true });
        void self; void silent;
      };
    }
  }
  /** La explosión no la daña: la espanta al techo durante 9 s. */
  onScare(g) {
    if (this.state === 'fled' || this.dead) return;
    this.setState('fled'); this.fledT = 9; this.untargetable = true; this.canMorph = false;
    g.fx.burst(this.cx, this.cy, 10, '#9a7ac0', 160, 0.4, 3, 0);
  }
  preHit(g, info) {
    if (info.kind === 'explosion' || info.kind === 'fireball') { this.onScare(g); return { cancel: true }; }
    return null;
  }
  kill(g, info) { if (this.state === 'fled') this.noCoins = true; super.kill(g, info); }
  onRespawn() { this.state = 'idle'; this.untargetable = false; this.dropY = 0; this.y = this.homeY; }
  contactRect() { return this.state === 'fled' ? null : this; }
  paint(c) {
    const y0 = -this.h;
    // hilo al techo
    c.strokeStyle = 'rgba(240,240,240,0.7)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, y0); c.lineTo(0, y0 - (this.y - this.homeY) - 24); c.stroke();
    if (this.state === 'fled') c.globalAlpha = 0.25;
    c.strokeStyle = '#4a3a66'; c.lineWidth = 2.2;
    const w = Math.sin(this.animT * 8);
    for (let i = 0; i < 4; i++) {
      const s = i < 2 ? -1 : 1, k = i % 2;
      c.beginPath(); c.moveTo(s * 5, y0 + 12); c.quadraticCurveTo(s * (13 + k * 3), y0 + 6 + w * 2, s * (15 + k * 4), y0 + 17 + k * 3 + w * 2); c.stroke();
    }
    c.fillStyle = '#7a5aa0'; c.beginPath(); c.ellipse(0, y0 + 14, 11, 9, 0, 0, TAU); c.fill();
    c.fillStyle = '#5a3a80'; c.beginPath(); c.arc(8, y0 + 12, 6, 0, TAU); c.fill();
    c.fillStyle = '#ff5a5a'; c.beginPath(); c.arc(10, y0 + 10, 1.6, 0, TAU); c.arc(7, y0 + 9, 1.4, 0, TAU); c.fill();
    c.fillStyle = '#e8d8ff'; c.beginPath(); c.moveTo(-3, y0 + 10); c.lineTo(0, y0 + 16); c.lineTo(3, y0 + 10); c.fill();
  }
}

// ---------------------------------------------------------------------
export class Spiderling extends Enemy {
  static def = { name: 'Arañita', hp: 8, coins: [0, 1], w: 16, h: 11, contact: 5, color: '#7a5aa0' };
  init() { this.removeDead = true; this.jumpCd = 0; }
  ai(g, dt) {
    const T = this.tgt(g);
    this.face(T.x);
    this.jumpCd -= dt;
    this.accelX(this.facing * this.spd(150), 1400, dt);
    if (this.onGround && this.jumpCd <= 0 && (this.wallAhead(g) || (Math.abs(T.x - this.cx) < 100 && chance(0.04)))) { this.vy = -560; this.jumpCd = 0.6; }
    this.physics(g, dt);
  }
  onScare(g) { if (!this.dead) this.kill(g, { kind: 'explosion' }); }
  paint(c) {
    c.strokeStyle = '#4a3a66'; c.lineWidth = 1.5;
    const w = Math.sin(this.animT * 22) * 2;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-3 + i * 3, -5); c.lineTo(-6 + i * 6 + w, 0); c.stroke(); }
    c.fillStyle = '#7a5aa0'; c.beginPath(); c.ellipse(0, -6, 7, 5, 0, 0, TAU); c.fill();
    c.fillStyle = '#ff5a5a'; c.fillRect(4, -9, 2, 2);
  }
}

// ---------------------------------------------------------------------
export class Treant extends Enemy {
  static def = { name: 'Arbusto-treant', hp: 120, coins: [6, 10], w: 38, h: 42, contact: 12, color: '#3f7a3a', heavy: true };
  init() { this.shotT = 1.2; this.berry = Math.random() < 0.5 ? '#e8c34a' : '#e8883a'; this.setState('camo'); }
  get harmless() { return this.state === 'camo'; }
  set harmless(v) { /* sólo lectura */ }
  wake() { if (this.state === 'camo') { this.setState('awake'); this.g.fx.burst(this.cx, this.cy, 10, '#6fbf5a', 160, 0.4, 3, 0); this.g.fx.text(this.cx, this.y - 6, '¡!', '#ffe27a', 0.6, 16); } }
  onDamaged() { this.wake(); }
  ai(g, dt) {
    const T = this.tgt(g);
    const d = Math.hypot(T.x - this.cx, T.y - this.cy);
    if (this.state === 'camo') {
      if (d < 230 && !T.fairy || (T.fairy && d < 230)) this.wake();
      this.physics(g, dt);
      return;
    }
    this.face(T.x);
    this.shotT -= dt;
    const away = Math.abs(T.x - this.cx) < 90 ? 0 : 1;
    this.accelX(this.facing * this.spd(38) * away, 400, dt);
    if (this.onGround && (this.wallAhead(g) || !this.floorAhead(g))) this.vx = 0;
    if (this.shotT <= 0 && d < 560 && g.world.los(this.cx, this.cy, T.x, T.y)) {
      this.shotT = 2.2;
      this.throwBerry(g, T);
    }
    this.physics(g, dt);
  }
  throwBerry(g, T) {
    const dx = T.x - this.cx, t = clamp(Math.abs(dx) / 320, 0.5, 1.2);
    const self = this;
    const pr = this.shoot(g, {
      x: this.cx, y: this.y + 8, vx: dx / t, vy: (T.y - this.y) / t - 0.5 * 1100 * t, r: 9, dmg: 14, life: 5, grav: 1100, bounce: 3, bounceK: 0.78,
      color: this.berry, shape: 'berry', kind: 'enemy', cut: true, reflect: true, shieldKill: true, berry: true,
    });
    pr.onPlayer = function (gg) { this.die(gg); return false; };
    pr.onReflect = function () { this.homeTo = self; this.grav = 0; };
    const oldUpdate = null;
    pr.onUpdate = function (gg, dt) {
      if (this.reflected && this.homeTo && !this.homeTo.dead) {
        const a = Math.atan2(this.homeTo.cy - this.y, this.homeTo.cx - this.x), sp = Math.hypot(this.vx, this.vy) || 400;
        this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp;
        // llega a su dueño → explota
        if (Math.hypot(this.homeTo.cx - this.x, this.homeTo.cy - this.y) < 30) this.die(gg);
      }
      void oldUpdate;
    };
    pr.onDie = function (gg) {
      if (this.exploded) return;
      this.exploded = true;
      if (this.reflected) {
        gg.explosion(this.x, this.y, 80, 40, { kind: 'explosion', knock: 360, radial: true, lift: 160, color: '#ffb36a' });
        gg.fx.ring(this.x, this.y, 6, 80, 0.4, '#ffb36a', 6);
        audio.sfx('explosion');
        // explosión en cadena con otras bayas cercanas
        for (const o of gg.projectiles) if (o.berry && !o.dead && o !== this && Math.hypot(o.x - this.x, o.y - this.y) < 110) gg.after(0.12, () => o.die(gg));
      } else {
        gg.enemyBlast(this.x, this.y, 44, 14, { color: '#ffb36a', kind: 'blast' });
        for (const o of gg.projectiles) if (o.berry && !o.dead && o !== this && o.team === 'enemy' && Math.hypot(o.x - this.x, o.y - this.y) < 60) o.die(gg);
      }
    };
    audio.sfx('fire');
  }
  paint(c, t) {
    const awake = this.state !== 'camo';
    const sway = Math.sin(this.animT * 2) * (awake ? 2 : 0.5);
    // raíces
    c.strokeStyle = '#4a3220'; c.lineWidth = 4; c.lineCap = 'round';
    const w = awake && Math.abs(this.vx) > 5 ? Math.sin(this.animT * 6) * 3 : 0;
    c.beginPath(); c.moveTo(-10, -8); c.lineTo(-12 + w, 0); c.moveTo(10, -8); c.lineTo(12 - w, 0); c.moveTo(0, -8); c.lineTo(0, 0); c.stroke();
    c.fillStyle = '#2f6b34';
    for (const [x, y, r] of [[-12, -20, 14], [10, -22, 15], [0, -32, 14], [-4, -14, 14], [14, -12, 11]]) { c.beginPath(); c.arc(x + sway * 0.3, y, r, 0, TAU); c.fill(); }
    c.fillStyle = '#3f8a42'; c.beginPath(); c.arc(-4, -34, 8, 0, TAU); c.fill();
    c.fillStyle = this.berry;
    for (const [x, y] of [[-12, -22], [8, -28], [2, -12], [14, -18], [-6, -36]]) { c.beginPath(); c.arc(x, y, 2.6, 0, TAU); c.fill(); }
    if (awake) {
      c.fillStyle = '#ffe27a'; c.beginPath(); c.arc(8, -22, 3.2, 0, TAU); c.arc(-2, -22, 3.2, 0, TAU); c.fill();
      c.fillStyle = '#2a1a0a'; c.fillRect(8, -23, 2, 3); c.fillRect(-2, -23, 2, 3);
      c.strokeStyle = '#4a3220'; c.lineWidth = 3; c.beginPath(); c.moveTo(14, -16); c.lineTo(22, -22 + Math.sin(this.animT * 4) * 3); c.stroke();
    }
  }
}

// ---------------------------------------------------------------------
/** Base de las hadas: orbitan al jugador y lo drenan mientras cantan. */
export class FairyBase extends Enemy {
  static def = { name: 'Hada', hp: 1, coins: [2, 4], w: 16, h: 16, contact: 0, color: '#ffffff', flies: true };
  init() {
    this.ang = Math.random() * TAU; this.waveT = 1; this.notes = 0;
    this.noDodge = new Set(['explosion', 'highwave']);
    this.hideBar = true;
    this.homeC = { x: this.cx, y: this.cy };
  }
  get detect() { return 300; }
  get orbitR() { return 120; }
  drainPlayer() {}
  ai(g, dt) {
    const p = g.player;
    const d = Math.hypot(p.cx - this.cx, p.cy - this.cy);
    this.alertT = 0;
    let tx, ty;
    if (d < this.detect && !p.hidden) {
      this.ang += dt * 1.2;
      tx = p.cx + Math.cos(this.ang) * this.orbitR; ty = p.cy - 60 + Math.sin(this.ang * 1.7) * 36;
      this.singing = true;
      this.drainPlayer(g, dt, p);
    } else {
      this.singing = false;
      this.ang += dt * 0.6;
      tx = this.homeC.x + Math.cos(this.ang) * 40; ty = this.homeC.y + Math.sin(this.ang * 1.3) * 24;
    }
    this.steer(tx, ty, this.spd(170), 700, dt);
    const res = moveBody(g.world, this, dt);
    if (res.l || res.r) this.vx *= -0.5;
    if (res.u || res.d) this.vy *= -0.5;
    this.facing = p.cx >= this.cx ? 1 : -1;
  }
  wave(g, p, color) {
    const a = Math.atan2(p.cy - this.cy, p.cx - this.cx);
    this.shoot(g, { x: this.cx, y: this.cy, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, r: 12, dmg: 10, life: 2.2, color, shape: 'wave', kind: 'enemy', sonic: true, cut: false, reflect: false, shieldKill: true });
    audio.sfx('screech');
  }
  paintFairy(c, body, glow, lyre) {
    const fl = Math.sin(this.animT * 40);
    c.fillStyle = glow; c.beginPath(); c.arc(0, -8, 13, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.beginPath(); c.ellipse(-4, -12, 7, 3 + fl * 2, -0.6, 0, TAU); c.ellipse(5, -12, 7, 3 - fl * 2, 0.6, 0, TAU); c.fill();
    c.fillStyle = body; c.beginPath(); c.arc(0, -8, 5, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(1, -10, 2, 0, TAU); c.fill();
    c.fillStyle = '#222'; c.fillRect(2, -9, 1.5, 1.5);
    if (this.singing) { // lira y notas
      c.strokeStyle = lyre; c.lineWidth = 1.6; c.beginPath(); c.arc(8, -4, 4, -1.2, 1.2); c.moveTo(8, -8); c.lineTo(8, 0); c.stroke();
      const ph = (this.animT * 1.4) % 1;
      c.globalAlpha = 1 - ph; c.fillStyle = lyre; c.font = 'bold 11px system-ui'; c.fillText('♪', 10, -14 - ph * 14); c.globalAlpha = 1;
    }
  }
}

export class WhiteFairy extends FairyBase {
  static def = { name: 'Hada blanca', hp: 1, coins: [2, 4], w: 16, h: 16, contact: 0, color: '#ffffff', flies: true, dodge: 0.15 };
  drainPlayer(g, dt, p) {
    if (p.mana > 0.01) p.drain(0, 1.5, dt); // 1,5 maná/s
    else {
      p.fairyT = 0.3;
      this.waveT -= dt;
      if (this.waveT <= 0) { this.waveT = 1.5; this.wave(g, p, '#bfe9ff'); }
    }
  }
  paint(c) { this.paintFairy(c, '#e8f4ff', 'rgba(190,230,255,0.28)', '#bfe9ff'); }
}
void TILE; void rrange; void Projectile;
