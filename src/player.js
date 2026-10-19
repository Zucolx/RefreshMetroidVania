// Jugador: movimiento común, magia, amuletos, daño, estados, meditación, idles y equipo de 3 personajes.
import { CONFIG, TILE } from './config.js';
import { Body, moveBody, standing } from './physics.js';
import { T } from './world.js';
import { clamp, approach, sign, snap8, lerp, rrange, chance, TAU } from './util.js';
import { Projectile } from './projectiles.js';
import { hasAmulet } from './combat.js';
import { createKit } from './characters/index.js';
import { drawRig, POSE0 } from './render/rig.js';
import { audio } from './audio.js';

export const PW = 22;
export const PH = 42;

export class Player extends Body {
  constructor(g, teamIds) {
    super(0, 0, PW, PH);
    this.g = g;
    this.setTeam(teamIds);
    this.resetAll();
  }

  setTeam(ids) {
    this.team = ids.map((id) => {
      const kit = createKit(id);
      return { id, kit, hp: kit.maxHp, maxHp: kit.maxHp, ko: false };
    });
    this.idx = 0;
  }
  get m() { return this.team[this.idx]; }
  get kit() { return this.team[this.idx].kit; }
  get hp() { return this.team[this.idx].hp; }
  set hp(v) { this.team[this.idx].hp = v; }
  get maxHp() { return this.team[this.idx].maxHp; }

  /** Reinicia todo el estado (nuevo nivel / reaparición total). */
  resetAll() {
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.mana = CONFIG.mana.max;
    this.manaFlash = 0;
    for (const m of this.team) { m.hp = m.maxHp; m.ko = false; m.kit.cd = {}; m.kit.cancel && m.kit.cancel(this, this.g); }
    this.resetState();
  }
  resetState() {
    this.onGround = false;
    this.coyote = 0; this.jumpBuf = 0;
    this.airJumps = 1; this.airDashes = this.maxAirDashes();
    this.usedDouble = false; this.jumpType = null; this.cutDone = true;
    this.dropT = 0;
    this.dashT = 0; this.dashCd = 0; this.dashDir = 1; this.dashSpeed = 0;
    this.sprint = { on: false, charges: 0, chargeT: 0, loseT: 0, skid: 0 };
    this.runMode = null;
    this.hj = null; this.hjFx = 0;
    this.hurtInv = 0; this.inv = 0; this.kbT = 0; this.webbed = 0; this.webCd = 0;
    this.atkLock = 0; this.atkBuf = 0; this.atkHold = 0; this.charging = false; this.chargeFired = false;
    this.swingAnim = null;
    this.magicHold = 0; this.magicCharging = false;
    this.shieldT = 0;
    this.mode = null;
    this.hidden = false;
    this.switchCd = 0;
    this.fairyT = 0;
    this.peakY = this.y; this.fallDist = 0; this.glided = false; this.passHit = new Set();
    this.stillT = 0; this.calmT = 0; this.meditating = false; this.medT = 0;
    this.idle = { on: false, kind: null, t: 0, blend: 0 };
    this.sinceHurt = 99; this.actionT = 99;
    this.lastSafe = { x: this.x, y: this.y };
    this.safeT = 0;
    this.runPhase = 0;
    this.lookT = 0;
    this.pose = { ...POSE0 };
    this.animName = 'idle';
    this.animT = 0;
    this.flip = null;
    this.windHit = new Map();
    this.landed = 0;
    this.trailT = 0;
    this.stompHit = new Set();
    this.tint = null;
    this.stoneSkin = false;
    this.ether = false;
    this.in = {};
  }
  maxAirDashes() {
    return CONFIG.dash.airDashes + (hasAmulet('wind') ? CONFIG.amulets.wind.extraAirDash : 0);
  }
  placeAt(cx, bottom) {
    this.setFeet(cx, bottom);
    this.snap();
    this.lastSafe = { x: this.x, y: this.y };
  }

  // =====================================================================
  //  Utilidades usadas por los kits
  // =====================================================================
  get feetY() { return this.y + this.h; }
  get airborne() { return !this.onGround; }
  get center() { return { x: this.cx, y: this.cy }; }
  hurtBox() { return { x: this.x + 2, y: this.y + 2, w: this.w - 4, h: this.h - 3 }; }
  isInvuln() {
    if (this.hurtInv > 0 || this.inv > 0) return true;
    if (this.dashT > 0 && CONFIG.dash.invuln) return true;
    if (this.runMode && (this.runMode.kind === 'skate' || this.runMode.kind === 'rocket')) return true;
    if (this.mode && this.mode.invuln) return true;
    return false;
  }
  addMana(v) {
    if (v > 0) this.mana = Math.min(CONFIG.mana.max, this.mana + v);
    else this.mana = Math.max(0, this.mana + v);
  }
  spendMana(c) {
    if (CONFIG.cheats.infiniteMana) return true;
    if (this.mana + 1e-6 < c) { this.manaFlash = 0.6; audio.sfx('menu'); return false; }
    this.mana -= c;
    return true;
  }
  damageMul(info) {
    let m = 1;
    if (this.ether && ['flask', 'acid', 'vapor'].includes(info.kind)) m *= CONFIG.alchemist.etherDamageMul;
    return m;
  }
  aim8() {
    const I = this.in;
    const a = snap8(I.x || 0, I.y || 0);
    if (!a.x && !a.y) return { x: this.facing, y: 0 };
    return a;
  }
  /** Rebote: sustituye el vy y recupera doble salto y dash aéreo. */
  bounce(force) {
    this.vy = -force;
    this.onGround = false;
    this.airJumps = 1; this.usedDouble = false;
    this.airDashes = this.maxAirDashes();
    this.jumpType = null; this.cutDone = true;
    this.coyote = 0;
    this.peakY = this.y; this.fallDist = 0;
    this.glided = false;
    audio.sfx('bounce');
  }
  /** Hazard bajo los pies en los siguientes `reach` px: 'spike' | 'lava' | null. */
  hazardBelow(reach) {
    const w = this.g.world;
    const y0 = this.feetY - 4;
    for (let d = 0; d <= reach; d += 8) {
      const hz = w.hazardAt({ x: this.x + 2, y: y0 + d, w: this.w - 4, h: 8 });
      if (hz) return hz;
      if (w.solidAtPx(this.cx, y0 + d + 4)) return null;
    }
    return null;
  }
  /** Distancia hasta el suelo/plataforma bajo los pies (null si más de max). */
  groundDist(max = 400) {
    const f = this.g.world.floorBelow(this.cx, this.feetY - 2, max);
    return f === null ? null : f - this.feetY;
  }
  entangle(sec) {
    if (this.webbed <= 0) this.g.fx.text(this.cx, this.y - 10, '¡enredado!', '#e8e8e8', 0.9, 12);
    this.webbed = Math.max(this.webbed, sec);
    this.endSprint();
  }
  untangle(sec) {
    if (this.webbed > 0) { this.webbed = Math.max(0, this.webbed - sec); if (this.webbed <= 0) this.g.fx.burst(this.cx, this.cy, 8, '#eee', 120, 0.4, 2, 0); }
  }
  breakWeb() { if (this.webbed > 0) { this.webbed = 0; this.g.fx.burst(this.cx, this.cy, 10, '#eee', 150, 0.4, 2, 0); } }
  endSprint() {
    this.sprint.on = false; this.sprint.charges = 0; this.sprint.chargeT = 0;
    if (this.runMode) this.endRunMode(false);
  }
  /** Fuerza de salto actual con bonificadores de sprint. */
  jumpForceNow(base, isDouble) {
    if (this.sprint.on) return base * (isDouble ? CONFIG.sprint.doubleJumpMul : CONFIG.sprint.jumpMul);
    return base;
  }
  sprintMul() {
    if (!this.sprint.on) return 1;
    if (hasAmulet('wind')) return 1.2 + CONFIG.amulets.wind.perCharge * Math.max(1, this.sprint.charges);
    return CONFIG.sprint.speedMul;
  }
  sprintRef() {
    return CONFIG.runSpeed * (hasAmulet('wind') ? 1.2 + CONFIG.amulets.wind.perCharge * CONFIG.amulets.wind.maxCharges : CONFIG.sprint.speedMul);
  }
  /** Teletransporte duro. */
  tpTo(cx, bottom) {
    this.setFeet(cx, bottom); this.snap(); this.vx = 0; this.vy = 0;
  }

  // =====================================================================
  //  Daño
  // =====================================================================
  /** Devuelve 'hurt' | 'blocked' | 'passed'. */
  hurt(amount, src = {}) {
    const g = this.g;
    if (this.hidden) return 'passed';
    if (CONFIG.cheats.invincible) return 'passed';
    const hazard = !!src.hazard;
    if (!src.ignoreInv && this.isInvuln()) return 'passed';
    // piel etérea: atraviesa enemigos sin daño por contacto
    if (this.ether && src.kind === 'contact') return 'passed';
    // viento con 3 cargas: atraviesa enemigos
    if (src.kind === 'contact' && this.windPierce()) return 'passed';
    if (src.kind === 'contact' && this.runMode && this.runMode.passContact) return 'passed';
    if (this.shieldT > 0 && !hazard && !src.ignoreShield) {
      g.fx.ring(this.cx, this.cy, 20, 48, 0.25, '#9fd0ff', 3);
      audio.sfx('shield');
      return 'blocked';
    }
    const kb = this.kit.blockHit(this, g, src);
    if (kb === 'blocked') return 'blocked';
    amount *= this.kit.damageTakenMul(this, src);
    amount = Math.max(1, Math.round(amount));
    this.hp -= amount;
    this.sinceHurt = 0;
    this.hurtInv = CONFIG.invulnTime;
    this.meditating = false; this.stillT = 0;
    this.idle.on = false; this.idle.blend = 0;
    audio.sfx('hurt');
    g.shake(4, 0.2);
    g.flash('#ff2a2a', 0.18);
    g.fx.text(this.cx, this.y - 8, `-${amount}`, '#ff6a6a', 0.9, 15);
    g.fx.burst(this.cx, this.cy, 10, '#ff4a4a', 200, 0.45, 3, 400);
    g.input.rumble(180, 0.7, 0.5);
    this.endSprint();
    this.cancelActions();
    this.kit.onHurt(this, g, amount, src);
    if (src.web) this.entangle(src.web === true ? 2 : src.web);
    if (!hazard && !src.noKnock) {
      const dir = Math.sign(this.cx - (src.x ?? this.cx - 1)) || -this.facing;
      const k = CONFIG.knockback * (this.stoneSkin ? 0.2 : 1);
      this.vx = dir * k; this.vy = -220 * (this.stoneSkin ? 0.4 : 1);
      this.kbT = 0.16; this.onGround = false;
      this.mode && this.mode.cancelOnHurt && this.endMode();
    }
    if (this.hp <= 0) this.down(src);
    return 'hurt';
  }
  /** Daño continuo que ignora invulnerabilidad (hada negra). */
  drain(hpPerSec, manaPerSec, dt) {
    this.fairyT = 0.3;
    this.meditating = false; this.stillT = 0;
    if (manaPerSec) this.addMana(-manaPerSec * dt);
    if (hpPerSec && !CONFIG.cheats.invincible && this.shieldT <= 0) {
      this.hp -= hpPerSec * dt;
      this.sinceHurt = 0;
      if (this.hp <= 0) this.down({ kind: 'drain' });
    }
  }
  windPierce() {
    return hasAmulet('wind') && this.sprint.on && this.sprint.charges >= CONFIG.amulets.wind.maxCharges;
  }
  cancelActions() {
    this.dashT = 0; this.hj = null;
    this.atkHold = 0; this.charging = false; this.chargeFired = false;
    this.magicHold = 0; this.magicCharging = false;
    this.swingAnim = null; this.atkLock = Math.min(this.atkLock, 0.05);
    this.kit.cancel(this, this.g);
  }
  endMode() {
    if (this.mode && this.mode.end) this.mode.end(this, this.g);
    this.mode = null;
  }
  /** El personaje activo cae. */
  down(src) {
    const g = this.g;
    const m = this.m;
    m.hp = 0; m.ko = true;
    g.fx.burst(this.cx, this.cy, 24, '#ff4a4a', 300, 0.8, 4, 500);
    g.fx.text(this.cx, this.y - 20, '✖ KO', '#ff4a4a', 1.4, 18);
    audio.sfx('kill');
    this.endMode();
    this.cancelActions();
    this.endSprint();
    this.kit.onSwitchOut(this, g);
    const next = this.nextAlive(1);
    if (next >= 0) {
      this.switchTo(next, true, true);
    } else {
      g.onTeamWiped(src);
    }
  }
  nextAlive(dir) {
    const n = this.team.length;
    for (let k = 1; k < n; k++) {
      const i = (this.idx + dir * k + n * 4) % n;
      if (!this.team[i].ko) return i;
    }
    return -1;
  }
  switchTo(i, heroic = false, relay = false) {
    const g = this.g;
    if (i === this.idx && !relay) return;
    if (!relay) this.kit.onSwitchOut(this, g);
    this.endMode();
    this.cancelActions();
    this.endSprint();
    this.meditating = false; this.idle.on = false; this.idle.blend = 0;
    this.shieldT = 0;
    this.ether = false; this.stoneSkin = false; this.tint = null;
    this.idx = i;
    this.switchCd = relay ? this.switchCd : CONFIG.team.switchCooldown;
    g.fx.smoke(this.cx, this.cy, 5);
    g.fx.burst(this.cx, this.cy, 12, this.kit.pal.accent, 200, 0.5, 3, 100);
    audio.sfx('swap');
    this.kit.onSwitchIn(this, g);
    if (heroic) {
      this.facing = 1;
      this.inv = Math.max(this.inv, CONFIG.team.entryInvuln);
      this.beginEntry();
    }
  }
  beginEntry() {
    audio.sfx('entry');
    this.kit.entry(this, this.g);
  }
  /** Entrada heroica con caída desde el cielo (hasta `tiles` casillas libres). */
  dropIn(tiles, onLand, speed = 0) {
    const w = this.g.world;
    let free = 0;
    const tx0 = Math.floor((this.x + 1) / TILE), tx1 = Math.floor((this.x + this.w - 1) / TILE);
    for (let n = 1; n <= tiles; n++) {
      const ty = Math.floor((this.y - n * TILE) / TILE);
      let ok = true;
      for (let tx = tx0; tx <= tx1; tx++) if (w.get(tx, ty) === T.SOLID) ok = false;
      if (!ok) break;
      free = n;
    }
    this.y -= free * TILE; this.vy = 0; this.vx = 0;
    this.snap();
    const top = this.y - 20;
    this.mode = {
      name: 'dropin', invuln: true, thread: speed ? top : undefined,
      update(p, g, dt) {
        if (speed) p.vy = speed; else p.vy = Math.min(p.vy + CONFIG.gravity * dt * 1.2, CONFIG.maxFall);
        const r = moveBody(g.world, p, dt);
        p.onGround = r.d;
        if (r.d) { p.mode = null; onLand && onLand(p, g); }
        return true;
      },
    };
  }
  /** Reaparición por hazard: última posición segura. */
  returnToSafe() {
    this.x = this.lastSafe.x; this.y = this.lastSafe.y; this.vx = 0; this.vy = 0;
    this.snap();
    this.g.fx.burst(this.cx, this.cy, 12, '#ffffff', 160, 0.5, 3, 0);
    this.endMode();
    this.dashT = 0;
  }

  // =====================================================================
  //  Actualización principal
  // =====================================================================
  update(g, inp, dt) {
    this.snap();
    const CF = CONFIG;
    // ---- temporizadores ----
    for (const k of ['coyote', 'jumpBuf', 'dashCd', 'hurtInv', 'inv', 'kbT', 'atkLock', 'atkBuf', 'dropT', 'switchCd', 'manaFlash', 'shieldT', 'fairyT', 'webCd']) {
      if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);
    }
    if (this.webbed > 0) this.webbed = Math.max(0, this.webbed - dt);
    this.sinceHurt += dt;
    this.actionT += dt;
    this.animT += dt;
    if (this.swingAnim) { this.swingAnim.t += dt; if (this.swingAnim.t >= this.swingAnim.dur + 0.08) this.swingAnim = null; }
    if (this.flip) { this.flip.t += dt; if (this.flip.t > this.flip.dur) this.flip = null; }

    // ---- entrada ----
    const I = this.readInput(inp);
    this.in = I;

    // ---- kits (todos los miembros) ----
    this.team.forEach((m, i) => {
      m.kit.tick(this, g, dt, i === this.idx);
      if (i !== this.idx && !m.ko && m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + CF.team.reserveRegen * dt);
    });

    // ---- cambio de personaje ----
    if ((I.prevP || I.nextP) && !this.mode) this.trySwitch(I.nextP ? 1 : -1);

    if (this.mode) {
      const handled = this.mode.update(this, g, dt, I);
      if (handled) { this.afterMove(g, dt, I); this.updatePose(dt, I); return; }
    }

    this.kit.preUpdate && this.kit.preUpdate(this, g, dt, I);

    // ---- sprint / modos de carrera ----
    this.updateSprint(dt, I);

    // ---- dash ----
    if (I.dashP) this.tryDash(g, I);
    const dashing = this.dashT > 0;
    if (dashing) this.updateDash(g, dt, I);

    // ---- movimiento horizontal ----
    const controlLocked = this.kbT > 0 || dashing;
    if (!controlLocked) this.moveHorizontal(dt, I);

    // ---- salto ----
    if (!dashing) this.updateJump(g, dt, I);

    // ---- ataque / magia / especial ----
    this.updateActions(g, dt, I);

    // ---- gravedad ----
    // integración con velocidad media: alturas de salto exactas (v²/2g)
    let vyNew = null;
    if (!dashing) {
      const vOld = this.vy;
      vyNew = Math.min(vOld + CF.gravity * dt, CF.maxFall);
      if (this.kit.glides && this.kit.glides(this, I) && vyNew > 0) {
        vyNew = Math.min(vyNew, CF.glideFall);
        this.glided = true;
        this.gliding = true;
      } else this.gliding = false;
      this.vy = (vOld + vyNew) / 2;
    } else this.gliding = false;

    // ---- física ----
    const wasGround = this.onGround;
    const res = moveBody(g.world, this, dt, { drop: this.dropT > 0 });
    this.lastRes = res;
    if (vyNew !== null && !res.d && !res.u) this.vy = vyNew;
    let grounded = res.d;
    if (!grounded && dashing && wasGround) grounded = !!standing(g.world, this, this.dropT > 0);
    this.onGround = grounded;
    if (!grounded) this.ride = null;
    if (grounded) {
      if (!wasGround) this.land(g, wasGround);
    } else if (wasGround) {
      this.peakY = this.y; // acaba de salir del suelo
    }
    if (res.u) this.cutDone = true;
    this.peakY = Math.min(this.peakY, this.y);
    if (!this.onGround) this.fallDist = Math.max(0, this.y - this.peakY);

    this.runModeCollide(g, res, dt);
    this.afterMove(g, dt, I);
    this.updatePose(dt, I);
  }

  readInput(inp) {
    const I = {
      x: inp.moveX, y: inp.moveY,
      jumpP: !!inp.pressed.jump, jumpH: !!inp.held.jump, jumpR: !!inp.released.jump,
      atkP: !!inp.pressed.attack, atkH: !!inp.held.attack, atkR: !!inp.released.attack,
      dashP: !!inp.pressed.dash,
      magicP: !!inp.pressed.magic, magicH: !!inp.held.magic, magicR: !!inp.released.magic,
      specP: !!inp.pressed.special, specH: !!inp.held.special, specR: !!inp.released.special,
      prevP: !!inp.pressed.prev, nextP: !!inp.pressed.next,
    };
    // Con enredo/KO no hay entradas especiales; el modo puede bloquearlas.
    I.any = !!(I.x || I.y || I.jumpH || I.atkH || inp.held.dash || I.magicH || I.specH || I.jumpP || I.atkP || I.dashP || I.magicP || I.specP);
    return I;
  }

  trySwitch(dir) {
    if (this.switchCd > 0) { this.g.fx.text(this.cx, this.y - 10, `cambio ${this.switchCd.toFixed(1)}s`, '#ff9090', 0.5, 11); return; }
    const n = this.nextAlive(dir);
    if (n < 0) return;
    this.switchTo(n, false, false);
  }

  // ---------- horizontal ----------
  speedMulTotal() {
    let m = this.sprintMul();
    if (this.webbed > 0) m *= 0.45;
    m *= this.kit.speedMul(this);
    if (this.charging) m *= this.kit.chargeSlow;
    if (this.hj) m = 0;
    return m;
  }
  moveHorizontal(dt, I) {
    const onG = this.onGround;
    let tx = I.x * CONFIG.runSpeed * this.speedMulTotal();
    if (this.runMode && (this.runMode.kind === 'skate' || this.runMode.kind === 'rocket')) {
      tx = this.runMode.dir * this.runMode.speed;
      this.vx = approach(this.vx, tx, 6000 * dt);
      this.facing = this.runMode.dir;
      return;
    }
    let a = onG ? CONFIG.accelGround : CONFIG.accelAir;
    if (!I.x) a *= onG ? 1 : 0.6;
    // en sprint, el sentido contrario deriva (se conserva el sprint)
    if (this.sprint.on && I.x && sign(this.vx) && sign(I.x) !== sign(this.vx) && onG && Math.abs(this.vx) > 140) {
      this.sprint.skid = CONFIG.sprint.skid;
      if (Math.random() < 0.5) this.g.fx.dot(this.cx - sign(this.vx) * 6, this.feetY - 2, -sign(this.vx) * rrange(10, 60), rrange(-60, -10), 0.3, '#ddd', 3, 0);
    }
    if (this.sprint.skid > 0) this.sprint.skid -= dt;
    if (I.x && Math.abs(this.vx) > Math.abs(tx) && sign(this.vx) === sign(I.x)) a *= 0.5; // no frenar en seco al salir de un modo veloz
    this.vx = approach(this.vx, tx, a * dt);
    if (I.x && !this.kit.lockFacing(this)) this.facing = I.x;
  }

  // ---------- sprint ----------
  updateSprint(dt, I) {
    const s = this.sprint;
    if (!s.on) return;
    if (I.x === 0 && this.onGround) {
      s.loseT += dt;
      if (s.loseT > CONFIG.sprint.loseTime) { this.endSprint(); return; }
    } else if (I.x !== 0) s.loseT = 0;
    if (this.webbed > 0) { this.endSprint(); return; }
    if (hasAmulet('wind')) {
      s.chargeT += dt;
      if (s.chargeT >= CONFIG.amulets.wind.chargeEvery && s.charges < CONFIG.amulets.wind.maxCharges) {
        s.charges++; s.chargeT = 0;
        this.g.fx.ring(this.cx, this.cy, 6, 30, 0.3, '#bfe9ff', 3);
        audio.sfx('whoosh');
      }
    }
    // estela visual
    if (Math.abs(this.vx) > 200) {
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 0.04;
        const px = this.x, py = this.y, f = this.facing, kit = this.kit, pose = { ...this.pose };
        this.g.fx.ghost((c) => {
          c.save(); c.translate(px + this.w / 2, py + this.h); c.scale(f, 1);
          c.fillStyle = kit.pal.accent; c.globalAlpha *= 0.8;
          c.fillRect(-9, -40, 18, 40);
          c.restore();
        }, 0.22, 0.28);
      }
    }
  }

  // ---------- dash ----------
  tryDash(g, I) {
    if (this.dashCd > 0) return;
    if (!this.onGround && this.airDashes <= 0) return;
    if (this.mode && !this.mode.allowDash) return;
    if (this.hj) this.hj = null;
    const wind = hasAmulet('wind');
    const dir = I.x || this.facing;
    // ¿dash a velocidad máxima?
    const fast = this.sprint.on && sign(this.vx) === dir && Math.abs(this.vx) >= CONFIG.sprint.maxRatio * this.sprintRef() &&
      (!wind || this.sprint.charges >= CONFIG.amulets.wind.maxCharges);
    const chained = this.sprint.on;
    this.cancelActions();
    this.lastAct = { type: 'dash', time: g.time };
    this.dashT = CONFIG.dash.duration * (wind ? CONFIG.amulets.wind.dashTime : 1);
    this.dashDir = dir;
    this.dashSpeed = CONFIG.dash.speed * (wind ? CONFIG.amulets.wind.dashSpeed : 1);
    this.dashCd = CONFIG.dash.cooldown;
    this.facing = dir;
    if (!this.onGround) this.airDashes--;
    this.vy = 0;
    this.actionT = 0;
    this.runPre = fast;
    this.dashChained = chained;
    if (this.runMode) this.runMode.refresh = true;
    audio.sfx('dash');
    g.fx.burst(this.cx - dir * 8, this.feetY - 6, 8, '#ffffff', 200, 0.3, 3, 0, 1.2, dir > 0 ? Math.PI : 0);
    if (fast && !this.runMode) {
      const kind = this.kit.maxDash(this, g);
      if (kind) this.startRunMode(kind, dir);
    }
  }
  updateDash(g, dt, I) {
    this.dashT -= dt;
    this.vx = this.dashDir * this.dashSpeed;
    this.vy = 0;
    // imagen fantasma
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 0.025;
      const px = this.x, py = this.y, f = this.facing, kit = this.kit, wd = this.w, ht = this.h;
      g.fx.ghost((c) => {
        c.save(); c.translate(px + wd / 2, py + ht); c.scale(f, 1);
        c.fillStyle = kit.pal.accent; c.fillRect(-10, -ht, 20, ht); c.restore();
      }, 0.2, 0.4);
    }
    if (this.dashT <= 0) {
      this.dashT = 0;
      const held = I.x === this.dashDir;
      if (held) {
        const w = hasAmulet('wind');
        if (!this.sprint.on) { this.sprint.on = true; this.sprint.charges = w ? 1 : 0; this.sprint.chargeT = 0; }
        else if (w && this.dashChained) { this.sprint.charges = Math.min(CONFIG.amulets.wind.maxCharges, this.sprint.charges + 1); }
        this.sprint.loseT = 0;
        this.vx = this.dashDir * CONFIG.runSpeed * this.sprintMul();
      } else {
        this.vx = this.dashDir * CONFIG.runSpeed * 0.8;
      }
    }
  }

  // ---------- modos de carrera a velocidad máxima ----------
  startRunMode(kind, dir) {
    const sp = CONFIG.sprint;
    this.runMode = { kind, dir, speed: kind === 'skate' ? sp.skateSpeed : kind === 'rocket' ? sp.rocketSpeed : 0, t: 0, hitCd: 0 };
    this.g.fx.ring(this.cx, this.cy, 10, 50, 0.3, '#ffffff', 3);
    this.g.fx.text(this.cx, this.y - 14, kind === 'skate' ? '¡PATINETA!' : kind === 'rocket' ? '¡COHETE!' : '¡MÁXIMA!', '#ffe27a', 0.9, 14);
    this.kit.onRunMode && this.kit.onRunMode(this, this.g, kind, true);
  }
  endRunMode(hop) {
    const rm = this.runMode;
    if (!rm) return;
    this.runMode = null;
    this.kit.onRunMode && this.kit.onRunMode(this, this.g, rm.kind, false);
    if (hop) { this.vy = -400; this.onGround = false; this.flip = { t: 0, dur: 0.55, dir: rm.dir }; this.vx = rm.dir * 200; }
  }
  runModeCollide(g, res, dt) {
    const rm = this.runMode;
    if (!rm) return;
    rm.t += dt;
    rm.hitCd -= dt;
    this.kit.runTick && this.kit.runTick(this, g, dt, rm);
    // fin por soltar dirección → lo gestiona updateSprint (endSprint)
    if (rm.kind === 'skate' || rm.kind === 'rocket') {
      if (res.l || res.r) { this.endRunMode(true); return; }
      for (const e of g.enemies) {
        if (e.dead || e.untargetable || e.ghost) continue;
        const rx = this.x - 6, rw = this.w + 12;
        if (rx < e.x + e.w && rx + rw > e.x && this.y < e.y + e.h && this.y + this.h > e.y) {
          this.crash(g, rm);
          return;
        }
      }
    }
  }
  crash(g, rm) {
    const sp = CONFIG.sprint;
    const cx = this.cx + rm.dir * 18, cy = this.cy;
    const rad = rm.kind === 'skate' ? sp.skateWaveRadius : sp.rocketRadius;
    const dmg = rm.kind === 'skate' ? sp.skateWaveDamage : sp.rocketDamage;
    g.blast(cx, cy, rad, dmg, { kind: rm.kind, knock: 420, lift: 160, stun: 1.2, radial: true, tumble: true, dir: rm.dir });
    g.fx.ring(cx, cy, 10, rad, 0.4, rm.kind === 'skate' ? '#8fe0ff' : '#ff9a3a', 6);
    if (rm.kind === 'rocket') { g.fx.burst(cx, cy, 30, '#ff8a2a', 360, 0.7, 5, 200); audio.sfx('boom'); }
    else audio.sfx('hit');
    g.shake(7, 0.3);
    this.endRunMode(true);
  }

  // ---------- salto ----------
  updateJump(g, dt, I) {
    const CF = CONFIG;
    if (I.jumpP) this.jumpBuf = CF.jumpBuffer;
    if (this.onGround) {
      this.coyote = CF.coyote;
      this.airJumps = 1; this.usedDouble = false;
      if (this.dashCd <= 0 || true) this.airDashes = this.maxAirDashes();
    }
    // ↓ + salto sobre plataforma atravesable
    if (I.jumpP && I.y > 0 && this.onGround && this.onOneWay(g)) {
      this.dropT = 0.22; this.vy = 120; this.onGround = false; this.jumpBuf = 0; this.coyote = 0;
      return;
    }
    // ---- salto alto: carga ----
    if (this.hj) {
      const h = this.hj;
      if (!this.onGround || this.webbed > 0 || this.atkLock > 0) { this.hj = null; }
      else if (I.x !== 0) { this.hj = null; if (I.jumpH) this.doJump(false); }
      else if (!I.jumpH) { this.releaseHighJump(g, h); }
      else {
        h.t += dt;
        this.hjFx += dt;
        if (this.hjFx > 0.12) { this.hjFx = 0; g.fx.dot(this.cx + rrange(-12, 12), this.feetY - 2, rrange(-20, 20), rrange(-120, -60), 0.4, h.t >= CF.highJump.t2 ? '#ffe27a' : h.t >= CF.highJump.t1 ? '#8fe3ff' : '#ffffff', 3, 0); }
        if (!h.s1 && h.t >= CF.highJump.t1) { h.s1 = true; audio.sfx('charge'); g.fx.ring(this.cx, this.feetY, 8, 36, 0.3, '#8fe3ff', 3); }
        if (!h.s2 && h.t >= CF.highJump.t2) { h.s2 = true; audio.sfx('charged'); g.fx.ring(this.cx, this.feetY, 8, 56, 0.35, '#ffe27a', 4); }
      }
      return;
    }
    if (this.jumpBuf > 0 && (this.onGround || this.coyote > 0)) {
      const mode = CF.highJump.mode;
      const hjKey = mode === 'up' ? I.y < 0 : mode === 'down' ? I.y > 0 : true;
      if (hjKey && I.x === 0 && this.onGround && this.webbed <= 0 && I.jumpH && !this.mode) {
        this.hj = { t: 0 };
        this.endSprint();
        this.jumpBuf = 0;
        return;
      }
      this.doJump(false);
    } else if (I.jumpP && !this.onGround && this.coyote <= 0 && this.airJumps > 0 && this.webbed <= 0) {
      this.doJump(true);
    }
    // salto variable
    if (this.vy < 0 && !I.jumpH && !this.cutDone && (this.jumpType === 'normal' || this.jumpType === 'double')) {
      this.vy *= CF.jumpCut; this.cutDone = true;
    }
  }
  onOneWay(g) {
    const ty = Math.floor((this.feetY + 2) / TILE);
    const a = g.world.get(Math.floor((this.x + 2) / TILE), ty), b = g.world.get(Math.floor((this.x + this.w - 2) / TILE), ty);
    if ((a === T.PLAT || b === T.PLAT) && a !== T.SOLID && b !== T.SOLID) return true;
    return !!(this.ride && this.ride.oneWay);
  }
  doJump(isDouble) {
    const g = this.g;
    this.lastAct = { type: 'jump', time: g.time };
    if (isDouble) {
      if (this.airJumps <= 0) return;
      this.airJumps--;
      this.usedDouble = true;
      this.vy = -this.jumpForceNow(CONFIG.doubleJumpForce, true);
      this.jumpType = 'double';
      audio.sfx('djump');
      g.fx.ring(this.cx, this.feetY, 4, 22, 0.25, '#ffffff', 2);
      g.fx.burst(this.cx, this.feetY, 6, '#ffffff', 120, 0.3, 2.5, 0, 1.2, Math.PI / 2);
      this.peakY = this.y; this.fallDist = 0; this.glided = false;
    } else {
      this.vy = -this.jumpForceNow(CONFIG.jumpForce, false);
      this.jumpType = 'normal';
      audio.sfx('jump');
      g.fx.burst(this.cx, this.feetY, 5, '#cccccc', 80, 0.3, 2.5, 0, 1.4, -Math.PI / 2);
      this.peakY = this.y;
    }
    this.cutDone = false;
    this.onGround = false;
    this.coyote = 0; this.jumpBuf = 0;
    this.ride = null;
  }
  releaseHighJump(g, h) {
    const hj = CONFIG.highJump;
    this.hj = null;
    if (h.t < hj.t1) { this.doJump(false); this.cutDone = true; return; } // salto normal completo
    const big = h.t >= hj.t2;
    this.vy = -(big ? hj.f2 : hj.f1);
    this.jumpType = 'high'; this.cutDone = true;
    this.onGround = false; this.coyote = 0; this.jumpBuf = 0;
    this.airJumps = 1; this.usedDouble = false;
    this.peakY = this.y; this.glided = false;
    audio.sfx(big ? 'explosion' : 'jump');
    g.fx.burst(this.cx, this.feetY, big ? 22 : 10, big ? '#ffe27a' : '#8fe3ff', 260, 0.5, 3, 0, 1.6, -Math.PI / 2);
    if (big) {
      g.blast(this.cx, this.cy, hj.waveRadius, hj.waveDamage, { kind: 'highwave', knock: hj.wavePush, radial: true, lift: 100 });
      g.fx.ring(this.cx, this.feetY, 10, hj.waveRadius, 0.5, '#ffe27a', 7);
      g.fx.ring(this.cx, this.feetY, 4, hj.waveRadius * 0.7, 0.4, '#fff', 3);
      g.shake(6, 0.3);
    }
  }
  land(g, wasGround) {
    const fd = this.fallDist;
    this.airDashes = this.maxAirDashes();
    this.airJumps = 1; this.usedDouble = false;
    this.landed = 0.15;
    if (this.dashT > 0 && false) return;
    if (fd > 40) {
      audio.sfx('land');
      g.fx.burst(this.cx, this.feetY, 6, '#bbb', 120, 0.3, 2.5, 0, 1.6, -Math.PI / 2);
    }
    this.earthLanding(g, fd);
    this.fallDist = 0; this.peakY = this.y; this.glided = false;
    this.stompHit.clear();
    this.kit.onLand && this.kit.onLand(this, g, fd);
  }
  earthLanding(g, fd) {
    if (!hasAmulet('earth')) return;
    const E = CONFIG.amulets.earth;
    if (fd <= 124 || this.glided) return;
    const extra = clamp((fd - 124) / 500, 0, 1) * E.waveExtra;
    if (this.shieldT > 0) {
      g.blast(this.cx, this.feetY - 10, E.shieldWaveRadius, E.shieldWaveDamage, { kind: 'earthwave', knock: 420, radial: true, lift: 140 });
      g.fx.ring(this.cx, this.feetY, 10, E.shieldWaveRadius, 0.5, '#c9a46a', 8);
      g.addZone({ kind: 'quake', x: this.cx, y: this.feetY, r: E.quakeRadius, life: E.quakeTime, dps: E.quakeDps, color: '#c9a46a' });
      this.shieldT = 0;
      g.fx.burst(this.cx, this.cy, 18, '#9fd0ff', 260, 0.6, 3.5, 300);
      g.shake(9, 0.5);
    } else {
      g.blast(this.cx, this.feetY - 10, E.waveRadius, E.waveDamage + extra, { kind: 'earthwave', knock: 340, radial: true, lift: 120 });
      g.fx.ring(this.cx, this.feetY, 10, E.waveRadius, 0.4, '#c9a46a', 6);
      g.shake(5, 0.25);
    }
    audio.sfx('boom');
  }

  // ---------- ataque, magia y especial ----------
  updateActions(g, dt, I) {
    const kit = this.kit;
    const free = this.kbT <= 0 && !this.mode;
    // --- ataque ---
    if (free) {
      if (I.atkP) {
        this.atkHold = 0; this.chargeFired = false;
        let used = false;
        if (!this.onGround && I.y > 0) used = kit.airDown(this, g);
        if (!used) kit.attackPress(this, g);
        this.actionT = 0;
      }
      if (I.atkH) {
        if (!this.hj) this.atkHold += dt;
        if (this.atkHold >= CONFIG.team.chargeStart && !this.charging && !kit.blocksAttack(this)) {
          this.charging = true;
          this.endSprint();
          audio.sfx('charge');
        }
        if (this.charging) {
          kit.chargeUpdate(this, g, dt, this.atkHold);
          if (!this.chargeFired && this.atkHold >= kit.chargeTime) {
            this.chargeFired = true;
            kit.chargeFire(this, g);
            this.actionT = 0;
          }
        }
      }
      if (I.atkR || (!I.atkH && this.atkHold > 0)) {
        kit.attackRelease(this, g, this.atkHold);
        this.atkHold = 0; this.charging = false; this.chargeFired = false;
      }
      if (this.atkBuf > 0 && this.atkLock <= 0) { this.atkBuf = 0; kit.attackPress(this, g); }
      // --- especial ---
      if (I.specP) { kit.specialPress(this, g); this.specHold = 0; this.actionT = 0; }
      if (I.specH) { this.specHold = (this.specHold || 0) + dt; kit.specialHold(this, g, dt, this.specHold); }
      if (I.specR) { kit.specialRelease(this, g, this.specHold || 0); this.specHold = 0; }
      // --- magia ---
      this.updateMagic(g, dt, I);
    } else {
      this.atkHold = 0; this.charging = false;
    }
  }
  updateMagic(g, dt, I) {
    const M = CONFIG.magic;
    if (I.magicP) {
      this.actionT = 0;
      if (I.y > 0) { this.castShield(g); this.magicCharging = false; this.magicHold = 0; return; }
      if (I.y < 0) { this.castExplosion(g); this.magicCharging = false; this.magicHold = 0; return; }
      this.magicCharging = true; this.magicHold = 0;
    }
    if (this.magicCharging) {
      if (I.magicH) {
        this.magicHold += dt;
        if (this.magicHold >= M.chargedTime && !this.magicReady) { this.magicReady = true; audio.sfx('charge'); g.fx.ring(this.cx, this.cy, 4, 30, 0.3, '#c9a0ff', 3); }
      }
      if (I.magicR || !I.magicH) {
        const charged = this.magicHold >= M.chargedTime;
        this.magicCharging = false; this.magicReady = false;
        this.castBolt(g, charged);
        this.magicHold = 0;
      }
    }
  }
  castBolt(g, charged) {
    const M = CONFIG.magic;
    const cost = charged ? M.chargedCost : M.boltCost;
    if (!this.spendMana(cost)) { if (!charged || !this.spendMana(M.boltCost)) return; charged = false; }
    const a = this.aim8();
    const dir = this.facing;
    const dx = a.x || dir, dy = a.y;
    const l = Math.hypot(dx, dy) || 1;
    const sp = charged ? M.chargedSpeed : M.boltSpeed;
    const water = charged && hasAmulet('water');
    const p = new Projectile({
      x: this.cx + (dx / l) * 16, y: this.cy - 4 + (dy / l) * 14, vx: (dx / l) * sp, vy: (dy / l) * sp,
      r: charged ? 11 : 6, team: 'player', kind: charged ? 'charged' : 'bolt', dmg: charged ? M.chargedDamage : M.boltDamage,
      life: 1.6, pierce: charged ? 99 : 0, color: water ? '#6fd0ff' : charged ? '#c9a0ff' : '#e8d8ff', shape: 'bolt', magic: true, knock: charged ? 300 : 120, owner: this,
    });
    g.projectiles.push(p);
    if (!(dx === 0)) this.facing = dx > 0 ? 1 : -1;
    audio.sfx(charged ? 'charged' : 'magic');
    g.fx.burst(p.x, p.y, 6, p.color, 140, 0.25, 2.5, 0);
    this.swingAnim = { t: 0, dur: 0.18, from: -0.3, to: 0.2 };
    this.actionT = 0;
  }
  castShield(g) {
    const M = CONFIG.magic;
    if (this.shieldT > 0) return;
    if (!this.spendMana(M.shieldCost)) return;
    this.shieldT = M.shieldTime + (hasAmulet('earth') ? CONFIG.amulets.earth.shieldBonus : 0);
    audio.sfx('shield');
    g.fx.ring(this.cx, this.cy, 10, M.shieldRadius, 0.3, '#9fd0ff', 4);
  }
  castExplosion(g) {
    const M = CONFIG.magic;
    if (!this.spendMana(M.explosionCost)) return;
    this.breakWeb();
    g.fx.text(this.cx, this.y - 12, '¡EXPLOSIÓN!', '#ffb36a', 0.8, 13);
    if (hasAmulet('fire')) {
      g.spawnFireballs(this);
    } else {
      g.explosion(this.cx, this.cy, M.explosionRadius, M.explosionDamage, { kind: 'explosion', knock: 360, radial: true, lift: 120, scare: true, breakWeb: true });
      g.fx.ring(this.cx, this.cy, 10, M.explosionRadius, 0.45, '#ffb36a', 8);
      g.fx.disc(this.cx, this.cy, 10, M.explosionRadius * 0.8, 0.35, 'rgba(255,200,120,0.8)');
      g.shake(6, 0.3);
    }
    g.scareSpiders(this.cx, this.cy, M.explosionRadius);
    audio.sfx('explosion');
    this.actionT = 0;
  }

  // =====================================================================
  //  Después del movimiento
  // =====================================================================
  afterMove(g, dt, I) {
    const CF = CONFIG;
    // posición segura
    if (this.onGround && !this.mode) {
      this.safeT += dt;
      if (this.safeT >= 0.25) {
        const w = g.world;
        const below = w.get(Math.floor(this.cx / TILE), Math.floor((this.feetY + 2) / TILE));
        const nearHz = w.hazardAt({ x: this.x - 22, y: this.y, w: this.w + 44, h: this.h + 6 });
        if ((below === T.SOLID || below === T.PLAT) && !nearHz && this.ride === null) { this.lastSafe.x = this.x; this.lastSafe.y = this.y; }
      }
    } else if (!this.onGround) this.safeT = 0;
    // hazards
    const hz = g.world.hazardAt(this.hurtBox());
    if (hz && !this.mode?.noHazard) {
      const spike = hz === 'spike';
      const wasInv = this.hurtInv > 0;
      if (!wasInv) this.hurt(spike ? 15 : 25, { hazard: true, ignoreInv: true, kind: hz });
      g.fx.burst(this.cx, this.cy, 8, spike ? '#ddd' : '#ff8a2a', 200, 0.4, 3, 300);
      this.returnToSafe();
      if (this.hp <= 0) return;
    }
    // caída fuera del mapa
    if (this.y > g.world.pxH + 200) this.returnToSafe();
    // amuleto de tierra: daño al atravesar enemigos cayendo
    if (hasAmulet('earth') && this.vy > 200 && this.fallDist > 124 && !this.glided) {
      for (const e of g.enemies) {
        if (e.dead || e.untargetable || this.stompHit.has(e)) continue;
        if (this.x < e.x + e.w && this.x + this.w > e.x && this.y < e.y + e.h && this.y + this.h > e.y) {
          this.stompHit.add(e);
          g.damageEnemy(e, CONFIG.amulets.earth.passDamage, { kind: 'earthpass', melee: false, knock: 80, from: { x: this.cx, y: this.cy }, dir: 0 });
        }
      }
    }
    // viento con 3 cargas: atraviesa enemigos con daño
    if (this.windPierce()) {
      for (const e of g.enemies) {
        if (e.dead || e.untargetable) continue;
        if (this.x < e.x + e.w && this.x + this.w > e.x && this.y < e.y + e.h && this.y + this.h > e.y) {
          const last = this.windHit.get(e) || -9;
          if (g.time - last > 0.5) {
            this.windHit.set(e, g.time);
            g.damageEnemy(e, CF.amulets.wind.pierceDamage, { kind: 'windsprint', knock: 160, dir: this.facing, from: { x: this.cx - this.facing * 10, y: this.cy } });
          }
        }
      }
    }
    // escudo mágico: aparta enemigos y gestiona proyectiles
    if (this.shieldT > 0) this.shieldUpdate(g, dt);
    this.regen(g, dt, I);
    this.mediIdle(g, dt, I);
  }

  shieldUpdate(g, dt) {
    const r = CONFIG.magic.shieldRadius;
    for (const pr of g.projectiles) {
      if (pr.dead || pr.team !== 'enemy' || pr.unblockable) continue;
      if (Math.hypot(pr.x - this.cx, pr.y - this.cy) < r + pr.r) {
        if (pr.reflect) { pr.reflectBack(g, 2); g.fx.ring(pr.x, pr.y, 4, 24, 0.25, '#9fd0ff', 3); audio.sfx('parry'); }
        else if (pr.shieldKill) { pr.die(g); g.fx.burst(pr.x, pr.y, 6, '#9fd0ff', 140, 0.3, 2.5, 0); audio.sfx('shield'); }
      }
    }
    for (const e of g.enemies) {
      if (e.dead || e.heavy && false) continue;
      const d = Math.hypot(e.cx - this.cx, e.cy - this.cy);
      if (d < r + Math.max(e.w, e.h) * 0.5 && !e.ghost) {
        const dir = Math.sign(e.cx - this.cx) || 1;
        e.x += dir * 140 * dt;
        if (!e.flies) e.vx += dir * 200 * dt * 10;
      }
    }
  }

  regen(g, dt, I) {
    const mana = CONFIG.mana;
    if (this.fairyT > 0) return;
    const moving = Math.abs(this.vx) > 5 || !this.onGround || I.x !== 0;
    let rate = moving ? mana.regenMove : (this.stillT >= mana.stillDelay ? mana.regenStill : mana.regenMove);
    if (this.meditating) rate = Math.max(rate, CONFIG.meditation.mana);
    if (this.kit.id === 'mage') rate *= mana.mageBonus;
    if (rate > 0) this.addMana(rate * dt);
  }

  /** Meditación e idles. */
  mediIdle(g, dt, I) {
    const quiet = this.onGround && !I.any && Math.abs(this.vx) < 4 && this.atkLock <= 0 && this.dashT <= 0 &&
      !this.mode && !this.hj && !this.charging && this.kbT <= 0 && this.webbed <= 0 && !this.swingAnim && this.fairyT <= 0 && !this.runMode;
    if (quiet) this.stillT += dt; else { this.stillT = 0; }
    const MD = CONFIG.meditation;
    // ---- meditación ----
    const incomplete = this.hp < this.maxHp - 0.01 || this.mana < CONFIG.mana.max - 0.01;
    if (!quiet || !CONFIG.meditationEnabled || this.fairyT > 0) {
      if (this.meditating) { this.meditating = false; }
    } else if (!this.meditating && this.stillT >= MD.wait && incomplete) {
      this.meditating = true; this.medT = 0;
      audio.sfx('meditate');
    }
    if (this.meditating) {
      this.medT += dt;
      this.hp = Math.min(this.maxHp, this.hp + MD.hp * dt);
      if (Math.random() < dt * 14) g.fx.dot(this.cx + rrange(-14, 14), this.feetY - 2, rrange(-8, 8), rrange(-70, -30), 0.9, Math.random() < 0.5 ? '#9fe8c8' : '#9fc4ff', 3, 0, 'circ');
      if (this.hp >= this.maxHp - 0.01 && this.mana >= CONFIG.mana.max - 0.01) { this.meditating = false; g.fx.text(this.cx, this.y - 10, '¡completo!', '#9fe8c8', 0.9, 12); }
    }
    // ---- idles ----
    const I2 = this.idle;
    const combat = this.combatContext(g);
    if (quiet && !this.meditating && !combat) {
      this.calmT += dt;
    } else if (!quiet || combat) {
      this.calmT = 0;
      if (I2.on) { I2.on = false; }
    }
    if (!quiet) { I2.on = false; I2.blend = 0; I2.t = 0; }
    if (!I2.on && this.calmT >= CONFIG.idle.flavorWait && quiet) {
      I2.on = true; I2.t = 0; I2.kind = this.kit.pickFlavor();
    }
    if (I2.on) {
      I2.t += dt;
      if (I2.t >= this.kit.flavorDur) { I2.on = false; this.calmT = Math.max(0, CONFIG.idle.flavorWait - 2); }
    }
    I2.blend = approach(I2.blend, I2.on ? 1 : 0, dt / Math.max(0.01, CONFIG.idle.blend));
  }
  /** ¿Estamos en contexto de combate? (enemigo cerca, daño reciente, recursos no llenos, acción reciente). */
  combatContext(g) {
    if (this.sinceHurt < 4 || this.actionT < 2) return true;
    if (this.hp < this.maxHp - 0.01 || this.mana < CONFIG.mana.max - 0.01) return true;
    for (const e of g.enemies) {
      if (e.dead || e.untargetable || e.morph) continue;
      if (Math.hypot(e.cx - this.cx, e.cy - this.cy) < 380 && !e.harmlessIdle) return true;
    }
    return false;
  }
  get idleState() {
    if (!this.onGround || this.stillT < 0.05) return null;
    if (this.meditating) return 'meditate';
    return this.idle.blend > 0.5 ? 'flavor' : 'base';
  }

  // =====================================================================
  //  Pose y dibujo
  // =====================================================================
  updatePose(dt, I) {
    const P = { ...POSE0 };
    const t = this.animT;
    const sa = this.swingAnim;
    let anim = 'idle';
    const moving = Math.abs(this.vx) > 20 && this.onGround;
    if (this.mode && this.mode.pose) { anim = this.mode.pose(this, P, t) || 'mode'; }
    else if (this.meditating) {
      anim = 'meditate'; P.sit = 1; P.crouch = 12; P.arm = 0.25; P.armB = 0.3; P.bob = Math.sin(t * 1.6) * 1.2; P.headTilt = 0.1;
    } else if (this.hj) {
      anim = 'charge'; P.crouch = 6 + Math.min(4, this.hj.t * 3); P.squash = 0.86; P.arm = 1.3; P.armB = 1.2; P.legA = 0.5; P.legB = -0.5; P.kneeA = 0.8; P.kneeB = 0.8; P.lean = 0.05;
    } else if (this.dashT > 0) {
      anim = 'dash'; P.lean = 0.55; P.arm = -2.6; P.armB = -2.8; P.legA = -1.1; P.legB = 1; P.kneeA = 0.2; P.kneeB = 0.9;
    } else if (this.runMode && this.runMode.kind === 'skate') {
      anim = 'skate'; P.lean = 0.3; P.crouch = 3; P.legA = 0.5; P.legB = -0.5; P.kneeA = 0.6; P.kneeB = 0.6; P.arm = -0.4; P.armB = -1.3;
    } else if (this.runMode && this.runMode.kind === 'rocket') {
      anim = 'rocket'; P.lean = 0.8; P.legA = 1.0; P.legB = -0.1; P.kneeA = 0.1; P.kneeB = 0.9; P.arm = -0.3; P.armB = -2.8;
    } else if (!this.onGround) {
      if (this.gliding) { anim = 'glide'; P.arm = -1.2; P.armB = -1.6; P.legA = 0.2; P.legB = -0.15; P.lean = 0.05; }
      else if (this.vy < 0) { anim = 'jump'; P.legA = -0.55; P.legB = 0.45; P.kneeA = 0.9; P.kneeB = 0.3; P.arm = -0.9; P.armB = -1.4; P.lean = 0.05; }
      else { anim = 'fall'; P.legA = 0.55; P.legB = -0.4; P.kneeA = 0.3; P.kneeB = 0.5; P.arm = -0.5; P.armB = -0.9; }
    } else if (moving) {
      anim = this.sprint.on ? 'sprint' : 'run';
      const speed = Math.abs(this.vx);
      this.runPhase += speed * dt * 0.052;
      const s = Math.sin(this.runPhase), c = Math.cos(this.runPhase);
      const amp = this.sprint.on ? 1.15 : 0.9;
      P.legA = s * amp; P.legB = -s * amp;
      P.kneeA = 0.3 + Math.max(0, -c) * 0.9; P.kneeB = 0.3 + Math.max(0, c) * 0.9;
      P.bob = -Math.abs(c) * 1.6;
      P.lean = this.sprint.on ? 0.3 : 0.13;
      P.arm = 0.4 - s * 0.6; P.armB = 0.4 + s * 0.6;
      if (this.sprint.on) { P.arm = -0.7 - s * 0.4; P.armB = 0.5 + s * 0.5; }
    } else {
      // reposo: idle_base o idle_flavor
      anim = this.idle.blend > 0.5 ? 'idle_flavor' : 'idle_base';
      this.kit.idleBase(this, t, P);
      if (this.idle.blend > 0 && this.idle.kind) this.kit.idleFlavor(this, this.idle.t, this.idle.kind, this.idle.blend, P);
      this.runPhase = 0;
    }
    if (this.landed > 0) { this.landed -= dt; P.crouch += this.landed * 22; P.squash *= 1 - this.landed * 0.9; }
    if (this.sprint.skid > 0) P.lean = -0.25;
    if (this.webbed > 0) P.lean += Math.sin(t * 20) * 0.04;
    if (this.kbT > 0) { P.lean = -0.35; P.arm = -1.9; P.armB = -1.7; anim = 'hurt'; }
    if (sa) {
      const k = clamp(sa.t / sa.dur, 0, 1);
      const e = k * k * (3 - 2 * k);
      P.arm = lerp(sa.from, sa.to, e);
      if (sa.weaponRot !== undefined) P.weaponRot = sa.weaponRot;
      if (sa.armB !== undefined) P.armB = sa.armB;
      if (sa.lean !== undefined) P.lean += sa.lean * Math.sin(k * Math.PI);
      if (anim === 'idle_base' || anim === 'idle_flavor' || anim === 'idle') anim = 'attack'; else if (!['dash', 'skate', 'rocket'].includes(anim)) anim = anim + '_attack';
    }
    P.blink = Math.sin(t * 0.9) > 0.985 ? 1 : (Math.floor(t * 1.7) % 5 === 0 && (t % 1) > 0.9 ? 1 : 0);
    this.kit.poseMod && this.kit.poseMod(this, P, t);
    this.pose = P;
    this.animName = anim;
  }

  draw(ctx, cam, alpha, t) {
    if (this.hidden) return;
    const x = this.px + (this.x - this.px) * alpha + this.w / 2 - cam.x;
    const y = this.py + (this.y - this.py) * alpha + this.h - cam.y;
    const kit = this.kit;
    ctx.save();
    ctx.translate(x, y);
    if (this.hurtInv > 0 && this.kbT <= 0 && Math.floor(t * 22) % 2 === 0 && !this.ether) ctx.globalAlpha = 0.45;
    if (this.inv > 0 && Math.floor(t * 14) % 2 === 0 && this.hurtInv <= 0) ctx.globalAlpha = 0.65;
    if (this.flip) { // voltereta
      const k = this.flip.t / this.flip.dur;
      ctx.translate(0, -this.h / 2); ctx.rotate(k * TAU * this.flip.dir); ctx.translate(0, this.h / 2);
    }
    ctx.save();
    ctx.scale(this.facing, 1);
    kit.drawUnder && kit.drawUnder(ctx, this, this.pose, t);
    if (this.tint) ctx.globalAlpha *= this.tint.alpha;
    drawRig(ctx, this, kit, this.pose, this.animT);
    if (this.idle.blend > 0 && this.idle.kind) kit.drawFlavor(ctx, this, this.pose, this.idle.kind, this.idle.blend, this.idle.t);
    kit.drawOver && kit.drawOver(ctx, this, this.pose, t);
    if (this.tint) { // piel etérea: silueta turquesa translúcida
      ctx.globalCompositeOperation = 'source-atop';
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    this.drawStatus(ctx, t);
    ctx.restore();
    if (CONFIG.debug.hitboxes) {
      ctx.strokeStyle = '#4f4'; ctx.lineWidth = 1;
      ctx.strokeRect(this.x - cam.x, this.y - cam.y, this.w, this.h);
    }
  }
  drawStatus(ctx, t) {
    if (this.mode && this.mode.thread !== undefined) { // cae colgado de hilos
      ctx.strokeStyle = 'rgba(235,220,255,0.7)'; ctx.lineWidth = 1;
      const top = this.mode.thread - this.feetY;
      ctx.beginPath(); ctx.moveTo(-3, -46); ctx.lineTo(-3, top); ctx.moveTo(3, -46); ctx.lineTo(3, top); ctx.stroke();
    }
    // aura de meditación
    if (this.meditating) {
      ctx.save();
      const k = 0.5 + 0.5 * Math.sin(this.medT * 3);
      const gr = ctx.createRadialGradient(0, -18, 4, 0, -18, 44 + k * 6);
      gr.addColorStop(0, 'rgba(150,255,210,0.35)'); gr.addColorStop(1, 'rgba(150,200,255,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, -18, 50, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // carga de salto alto
    if (this.hj && this.hj.t > 0.2) {
      const p = Math.min(1, this.hj.t / CONFIG.highJump.t1);
      ctx.strokeStyle = this.hj.t >= CONFIG.highJump.t2 ? '#ffe27a' : this.hj.t >= CONFIG.highJump.t1 ? '#8fe3ff' : 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -2, 16 + p * 6, Math.PI, Math.PI + Math.PI * Math.min(1, this.hj.t / CONFIG.highJump.t2)); ctx.stroke();
    }
    // carga de ataque
    if (this.charging && !this.kit.noChargeGlow) {
      const p = clamp((this.atkHold - CONFIG.team.chargeStart) / Math.max(0.01, this.kit.chargeTime - CONFIG.team.chargeStart), 0, 1);
      ctx.strokeStyle = p >= 1 ? '#fff' : this.kit.pal.accent; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -20, 26 + p * 4, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke();
    }
    if (this.magicCharging && this.magicHold > 0.12) {
      const p = clamp(this.magicHold / CONFIG.magic.chargedTime, 0, 1);
      ctx.fillStyle = `rgba(190,150,255,${0.25 + p * 0.35})`;
      ctx.beginPath(); ctx.arc(0, -22, 8 + p * 14, 0, TAU); ctx.fill();
    }
    // escudo mágico
    if (this.shieldT > 0) {
      const r = CONFIG.magic.shieldRadius;
      const fade = this.shieldT < 1 ? (Math.floor(t * 12) % 2 ? 0.4 : 1) : 1;
      ctx.save(); ctx.globalAlpha = 0.28 * fade; ctx.fillStyle = '#7fb8ff';
      ctx.beginPath(); ctx.arc(0, -20, r, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.85 * fade; ctx.strokeStyle = '#cfe6ff'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, -20, r, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    if (this.webbed > 0) {
      ctx.strokeStyle = 'rgba(240,240,240,0.9)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(Math.cos(a) * 20, -20 + Math.sin(a) * 24); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(0, -20, 14, 17, 0, 0, TAU); ctx.stroke();
    }
    if (this.windPierce()) {
      ctx.strokeStyle = 'rgba(190,235,255,0.8)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-this.facing * (20 + i * 10), -10 - i * 10); ctx.lineTo(-this.facing * (40 + i * 14), -10 - i * 10); ctx.stroke(); }
    }
    this.kit.drawStatus && this.kit.drawStatus(ctx, this, t);
  }
}
