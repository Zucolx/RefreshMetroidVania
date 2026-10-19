// Clase base de enemigos: física, estados comunes (aturdido, ralentizado, rana, voltereta), muerte y reaparición.
import { CONFIG, TILE } from '../config.js';
import { Body, moveBody } from '../physics.js';
import { dropCoins } from '../coins.js';
import { sprites } from '../render/hybrid.js';
import { chance, clamp, rrange, TAU } from '../util.js';
import { Projectile } from '../projectiles.js';

export class Enemy extends Body {
  /** Valores por defecto; cada subclase los sobrescribe en static def. */
  static def = { name: 'Enemigo', hp: 30, coins: [0, 0], w: 26, h: 30, contact: 10, color: '#8a8' };

  constructor(g, spec) {
    const d = new.target.def;
    super(0, 0, d.w, d.h);
    this.g = g;
    this.type = spec.type;
    this.def = d;
    this.spec = spec;
    this.temp = !!spec.temp; // invocados: no reaparecen
    this.name = d.name;
    this.coins = d.coins;
    this.contact = d.contact ?? 0;
    this.heavy = !!d.heavy;
    this.ghost = !!d.ghost;
    this.fire = !!d.fire;
    this.flies = !!d.flies;
    this.dodge = d.dodge || 0;
    this.noDodge = d.noDodge || null;
    this.grav = d.flies ? 0 : CONFIG.gravity;
    this.hang = !!d.hang; // anclado al techo
    this.maxHp = Math.max(1, Math.round(d.hp * CONFIG.enemies.hpMul));
    this.hp = this.maxHp;
    this.facing = Math.random() < 0.5 ? -1 : 1;
    this.state = 'idle';
    this.st = 0; // tiempo en el estado
    this.stun = 0;
    this.slowT = 0; this.slowF = 1;
    this.flash = 0; this.hurtT = 0; this.thread = 0;
    this.dead = false; this.respawnT = 0;
    this.noCoins = false;
    this.morph = null;
    this.tumble = null;
    this.provoke = null; // { t, fairy }
    this.awake = false;
    this.contactCd = 0;
    this.animT = Math.random() * 10;
    this.home = this.place(spec);
    this.init && this.init(g, spec);
  }

  /** Coloca al enemigo en la casilla (x,y); devuelve el punto de reaparición. */
  place(spec) {
    const cx = spec.px !== undefined ? spec.px : spec.x * TILE + TILE / 2;
    if (this.hang) {
      this.x = cx - this.w / 2;
      this.y = spec.py !== undefined ? spec.py : spec.y * TILE + 2;
    } else {
      this.x = cx - this.w / 2;
      this.y = (spec.py !== undefined ? spec.py : (spec.y + 1) * TILE) - this.h - 0.01;
    }
    this.vx = 0; this.vy = 0;
    this.snap();
    return { x: this.x, y: this.y };
  }

  get dtScale() { return this.slowT > 0 ? this.slowF : 1; }
  spd(v) { return v * CONFIG.enemies.speedMul; }
  get alive() { return !this.dead; }
  hitRect() { return this; }

  // ---------- objetivo (el hada provoca a los enemigos) ----------
  tgt(g) {
    const f = this.provoke && this.provoke.fairy;
    if (f && f.alive && this.provoke.t > 0) return { x: f.x, y: f.y, fairy: f };
    const p = g.player;
    return { x: p.cx, y: p.cy, fairy: null };
  }
  distTo(t) { return Math.hypot(t.x - this.cx, t.y - this.cy); }
  seesPlayer(g, range) {
    const p = g.player;
    if (p.hidden) return false;
    const d = Math.hypot(p.cx - this.cx, p.cy - this.cy);
    return d <= range && g.world.los(this.cx, this.cy, p.cx, p.cy);
  }
  face(x) { this.facing = x >= this.cx ? 1 : -1; }

  // ---------- movimiento ----------
  gravity(dt) {
    this.vy = Math.min(this.vy + this.grav * dt, CONFIG.maxFall);
  }
  /** Mueve con colisión y gravedad; devuelve el resultado de colisión. */
  physics(g, dt) {
    if (this.hang) return { l: false, r: false, u: false, d: false };
    this.gravity(dt);
    const r = moveBody(g.world, this, dt);
    this.onGround = r.d;
    return r;
  }
  accelX(target, a, dt) {
    const d = target - this.vx;
    this.vx += clamp(d, -a * dt, a * dt);
  }
  floorAhead(g, dir = this.facing, look = 14) {
    const x = this.cx + dir * (this.w / 2 + look);
    return g.world.floorBelow(x, this.y + this.h - 4, 80) !== null;
  }
  wallAhead(g, dir = this.facing, look = 4) {
    const x = this.cx + dir * (this.w / 2 + look);
    return g.world.solidAtPx(x, this.y + this.h * 0.5) || g.world.solidAtPx(x, this.y + this.h - 6);
  }
  /** Enemigo aéreo: persigue a un punto con suavidad. */
  steer(tx, ty, speed, a, dt) {
    const dx = tx - this.cx, dy = ty - this.cy, d = Math.hypot(dx, dy) || 1;
    this.vx += clamp((dx / d) * speed - this.vx, -a * dt, a * dt);
    this.vy += clamp((dy / d) * speed - this.vy, -a * dt, a * dt);
  }

  // ---------- ciclo ----------
  update(g, rawDt) {
    this.snap();
    if (this.dead) {
      if (this.deadUpdate) this.deadUpdate(g, rawDt);
      this.animT += rawDt;
      if (!this.temp && CONFIG.enemies.respawn && !this.noRespawn) {
        this.respawnT -= rawDt;
        if (this.respawnT <= 0) {
          const p = g.player;
          const far = Math.hypot(p.cx - this.home.x, p.cy - this.home.y) > 560;
          if (far) this.respawn(g);
        }
      }
      return;
    }
    this.animT += rawDt;
    if (this.slowT > 0) { this.slowT -= rawDt; if (this.slowT <= 0) this.slowF = 1; }
    if (this.flash > 0) this.flash -= rawDt;
    if (this.hurtT > 0) this.hurtT -= rawDt;
    if (this.thread > 0) this.thread -= rawDt;
    if (this.contactCd > 0) this.contactCd -= rawDt;
    if (this.provoke) { this.provoke.t -= rawDt; if (this.provoke.t <= 0) this.provoke = null; }
    if (CONFIG.enemies.frozen && !this.tumble) {
      if (!this.hang) { this.vx = 0; this.vy = 0; }
      return;
    }
    const dt = rawDt * this.dtScale;
    if (this.morph) { this.morphUpdate(g, dt); return; }
    if (this.tumble) { this.tumbleUpdate(g, dt); return; }
    if (this.stun > 0) {
      this.stun -= dt;
      this.st += dt;
      if (this.stunUpdate) this.stunUpdate(g, dt);
      else { this.vx *= Math.pow(0.02, dt); this.physics(g, dt); }
      return;
    }
    this.st += dt;
    this.ai(g, dt);
  }
  ai() {}

  setState(s) { this.state = s; this.st = 0; }

  // ---------- transformaciones ----------
  morphInto(g) {
    this.morph = { t: 3.2, kind: Math.random() < 0.5 ? 'frog' : 'mouse', hpBackup: this.hp };
    this.hp = 1;
    this.stun = 0; this.tumble = null;
    g.fx.burst(this.cx, this.cy, 14, '#ff9bd8', 200, 0.5, 3, 0);
    g.fx.ring(this.cx, this.cy, 6, 36, 0.35, '#ffb4e6', 3);
    g.fx.text(this.cx, this.y - 10, this.morph.kind === 'frog' ? '¡rana!' : '¡ratón!', '#ffb4e6', 0.9, 13);
    this.w0 = this.w; this.h0 = this.h;
  }
  morphUpdate(g, dt) {
    const m = this.morph;
    m.t -= dt;
    const p = g.player;
    const dir = Math.sign(this.cx - p.cx) || 1;
    this.facing = dir;
    if (this.onGround && chance(0.06)) this.vy = -380;
    this.accelX(dir * 170, 900, dt);
    this.gravity(dt);
    moveBody(g.world, this, dt);
    this.onGround = this.vy === 0 || standingLike(g, this);
    if (m.t <= 0) {
      // desaparece sin monedas
      this.dead = true; this.noCoinsOnce = true; this.morph = null;
      this.respawnT = CONFIG.enemies.respawnTime;
      g.fx.burst(this.cx, this.cy, 10, '#ffb4e6', 160, 0.4, 3, 0);
    }
  }
  tumbleUpdate(g, dt) {
    const t = this.tumble;
    t.t -= dt;
    t.rot += t.spin * dt;
    this.vy = Math.min(this.vy + CONFIG.gravity * 0.7 * dt, CONFIG.maxFall);
    const r = moveBody(g.world, this, dt);
    if (r.d) { this.vx *= 0.75; t.spin *= 0.8; }
    if (r.l || r.r) this.vx *= -0.5;
    // choca con otros enemigos
    for (const o of g.enemies) {
      if (o === this || o.dead || o.untargetable || t.hit.has(o)) continue;
      if (o.x < this.x + this.w && o.x + o.w > this.x && o.y < this.y + this.h && o.y + o.h > this.y) {
        t.hit.add(o);
        g.damageEnemy(o, CONFIG.sprint.tumbleDamage, { kind: 'tumble', knock: 220, dir: Math.sign(this.vx) || 1, stun: 0.4, from: { x: this.cx, y: this.cy }, quiet: true });
        g.damageEnemy(this, 0, { kind: 'tumble', quiet: true });
        g.fx.burst((o.cx + this.cx) / 2, (o.cy + this.cy) / 2, 8, '#ffe27a', 200, 0.3, 3);
        g.audio.sfx('hit');
        this.vx *= -0.4;
      }
    }
    if (t.t <= 0) { this.tumble = null; this.stun = Math.max(this.stun, 0.2); }
  }
  startTumble(vx, vy, time = CONFIG.sprint.tumbleTime) {
    if (this.heavy || this.ghost || this.dead) { this.stun = Math.max(this.stun, 0.6); return; }
    this.tumble = { t: time, rot: 0, spin: (vx >= 0 ? 1 : -1) * 14, hit: new Set([]) };
    this.vx = vx; this.vy = vy;
    this.stun = 0;
  }
  applySlow(f, t) {
    this.slowF = Math.min(this.slowF, f);
    this.slowT = Math.max(this.slowT, t);
  }
  provokeBy(fairy, t) { this.provoke = { t, fairy }; this.alertT = 0.8; }

  // ---------- ataques cuerpo a cuerpo con ventana (parry) ----------
  /** o: { windup, active, recover, dmg, reach, h, offY, parry, kind, lunge } */
  startAtk(o) {
    this.atk = { t: 0, hit: false, parry: true, offY: 0, recover: 0.25, kind: 'melee', ...o };
    this.face(this.tgt(this.g).x);
    return this.atk;
  }
  updateAtk(g, dt) {
    const a = this.atk;
    if (!a) return false;
    a.t += dt;
    if (a.lunge && a.t >= a.windup && a.t < a.windup + a.active) this.vx = this.facing * a.lunge;
    if (a.t >= a.windup && a.t < a.windup + a.active && !a.hit) {
      const reach = a.reach;
      const x = this.facing > 0 ? this.cx : this.cx - reach;
      const rect = { x, y: this.cy - a.h / 2 + a.offY, w: reach, h: a.h };
      if (this.provoke && this.provoke.fairy) { /* el hada recibe daño por contacto en Game */ }
      const r = g.strikePlayer(rect, a.dmg, { x: this.cx, y: this.cy, kind: a.kind, e: this });
      if (r === 'hurt' || r === 'blocked') { a.hit = true; if (r === 'hurt') this.onHitPlayer && this.onHitPlayer(g); }
    }
    if (a.t >= a.windup + a.active + a.recover) { this.atk = null; this.onAtkEnd && this.onAtkEnd(g); }
    return true;
  }
  atkRect() { const a = this.atk; return a; }
  parryActive() { const a = this.atk; return !!(a && a.parry && a.t < a.windup + a.active); }
  cancelAttack() { this.atk = null; }
  /** Pinta el telegrafiado del ataque (se llama desde paint de cada enemigo). */
  atkProgress() { const a = this.atk; return a ? Math.min(1, a.t / Math.max(0.01, a.windup)) : 0; }

  // ---------- daño / muerte ----------
  onParried(g) { this.stun = Math.max(this.stun, 0.7); this.vx = 0; this.cancelAttack(); }
  kill(g, info) {
    if (this.dead) return;
    this.hp = Math.min(this.hp, 0);
    this.dead = true;
    this.respawnT = CONFIG.enemies.respawnTime;
    this.deadAt = g.time;
    if (!this.noCoins && !this.noCoinsOnce) dropCoins(g, this);
    g.fx.burst(this.cx, this.cy, 14, this.def.color || '#fff', 230, 0.55, 3.5, 400);
    g.fx.smoke(this.cx, this.cy, 3);
    g.audio.sfx('kill');
    g.stats.kills++;
    this.onKilled && this.onKilled(g, info);
  }
  respawn(g) {
    this.dead = false;
    this.hp = this.maxHp;
    this.noCoins = false; this.noCoinsOnce = false;
    this.stun = 0; this.morph = null; this.tumble = null; this.provoke = null;
    this.thread = 0; this.slowT = 0; this.slowF = 1;
    this.w = this.def.w; this.h = this.def.h;
    this.x = this.home.x; this.y = this.home.y;
    this.vx = 0; this.vy = 0; this.snap();
    this.setState('idle');
    this.onRespawn && this.onRespawn(g);
    g.fx.burst(this.cx, this.cy, 8, '#fff', 100, 0.4, 2.5, 0);
  }

  // ---------- proyectiles ----------
  shoot(g, o) {
    const p = new Projectile({ team: 'enemy', owner: this, ...o });
    g.projectiles.push(p);
    return p;
  }

  // ---------- dibujo ----------
  render(ctx, cam, alpha, t) {
    if (this.dead) { this.drawDead && this.drawDead(ctx, cam, t); return; }
    const x = this.px + (this.x - this.px) * alpha + this.w / 2 - cam.x;
    const y = this.py + (this.y - this.py) * alpha + this.h - cam.y;
    if (x < -150 || x > 1110 || y < -150 || y > 700) return;
    ctx.save();
    ctx.translate(x, y);
    if (this.hang) ctx.translate(0, 0);
    if (this.alpha !== undefined) ctx.globalAlpha = this.alpha;
    if (this.tumble) { ctx.translate(0, -this.h / 2); ctx.rotate(this.tumble.rot); ctx.translate(0, this.h / 2); }
    ctx.save();
    ctx.scale(this.facing, 1);
    if (this.morph) this.paintMorph(ctx, t);
    else {
      sprites.slot(ctx, this.type, 'body', this.state, this.animT, {}, (c) => this.paint(c, t));
      if (this.flash > 0) {
        ctx.globalAlpha = 0.55; ctx.globalCompositeOperation = 'lighter';
        this.paint(ctx, t);
      }
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    if (this.stun > 0 && !this.morph) {
      for (let i = 0; i < 3; i++) {
        const a = t * 6 + i * 2.1;
        ctx.fillStyle = '#ffe27a';
        ctx.fillRect(Math.cos(a) * 12 - 2, -this.h - 6 + Math.sin(a) * 4, 4, 4);
      }
    }
    if (this.provoke && this.provoke.t > 0) {
      ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#ff5a5a';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.strokeText('!', 0, -this.h - 8); ctx.fillText('!', 0, -this.h - 8);
    }
    if (this.thread > 0) { // hilo invisible apenas perceptible
      ctx.strokeStyle = 'rgba(230,190,255,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-this.w / 2, -this.h * 0.2); ctx.lineTo(this.w / 2, -this.h * 0.8); ctx.stroke();
    }
    if (this.hurtT > 0 && this.hp < this.maxHp && !this.hideBar) {
      const w = Math.max(24, this.w);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-w / 2, -this.h - 12, w, 4);
      ctx.fillStyle = '#e5504a'; ctx.fillRect(-w / 2, -this.h - 12, w * clamp(this.hp / this.maxHp, 0, 1), 4);
    }
    if (this.slowT > 0) {
      ctx.strokeStyle = 'rgba(120,190,255,0.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, -this.h / 2, Math.max(this.w, this.h) * 0.7, 0, TAU); ctx.stroke();
    }
    ctx.restore();
    if (CONFIG.debug.hitboxes) {
      ctx.strokeStyle = '#f55'; ctx.lineWidth = 1;
      ctx.strokeRect(this.x - cam.x, this.y - cam.y, this.w, this.h);
    }
  }
  paintMorph(ctx, t) {
    const m = this.morph;
    ctx.fillStyle = m.kind === 'frog' ? '#6fbf4a' : '#a89a8a';
    if (m.kind === 'frog') {
      ctx.beginPath(); ctx.ellipse(0, -7, 10, 7, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(5, -13, 3, 0, TAU); ctx.arc(-1, -13, 3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillRect(5, -14, 2, 2); ctx.fillRect(-1, -14, 2, 2);
    } else {
      ctx.beginPath(); ctx.ellipse(0, -6, 11, 6, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(9, -8, 4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d9b0b0'; ctx.beginPath(); ctx.arc(7, -13, 3, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#d9b0b0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-10, -6); ctx.quadraticCurveTo(-18, -2 + Math.sin(t * 10) * 3, -22, -8); ctx.stroke();
    }
  }
  paint(ctx) {
    ctx.fillStyle = this.def.color;
    ctx.fillRect(-this.w / 2, -this.h, this.w, this.h);
  }
}

function standingLike(g, e) {
  return g.world.solidAtPx(e.cx, e.y + e.h + 2);
}

/** Util: elige un entero al azar en un rango [a,b]. */
export function rrangeInt(a, b) { return Math.floor(rrange(a, b + 1)); }
