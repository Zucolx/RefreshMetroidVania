// Simulación del nivel: entidades, colisiones de combate, cámara y dibujo del mundo.
// No toca el DOM (la entrada llega por `input`): se puede ejecutar sin navegador para pruebas y validación.
import { CONFIG, TILE, STEP, VIEW_W, VIEW_H } from './config.js';
import { World, T } from './world.js';
import { Player } from './player.js';
import { Effects } from './effects.js';
import { Projectile } from './projectiles.js';
import { damageEnemy } from './combat.js';
import { Zone } from './zones.js';
import { createEnemy } from './enemies/index.js';
import { createProp } from './props.js';
import { drawDecor } from './decor.js';
import { drawTiles, drawBackground, drawForeground } from './themes.js';
import { clamp, circleRect, TAU, rrange } from './util.js';
import { audio } from './audio.js';
import { Store } from './storage.js';
import { AMULETS } from './items.js';
import { controls } from './controls.js';
import { FakeInput } from './input.js';

export class Game {
  constructor({ input = new FakeInput(), team = ['swordsman', 'mage', 'artificer'] } = {}) {
    this.input = input;
    this.audio = audio;
    this.fx = new Effects();
    this.time = 0;
    this.frame = 0;
    this.hitStop = 0;
    this.team = team;
    this.world = null;
    this.player = null;
    this.stats = { kills: 0 };
    this.cam = { x: 0, y: 0, sx: 0, sy: 0, shakeT: 0, shakeA: 0, flashC: null, flashT: 0, flashM: 0.2 };
    this.levelId = null;
    this.paused = false;
    this.banners = [];
    this.cfgDamageNumbers = false;
    this.clearLists();
  }

  clearLists() {
    this.enemies = []; this.projectiles = []; this.coins = []; this.zones = [];
    this.hitboxes = []; this.timers = []; this.props = []; this.pickups = [];
    this.checkpoints = []; this.signs = [];
    this.exitObj = null;
    this.fairy = null;
    this.fx.clear();
  }

  // =====================================================================
  //  Carga de nivel
  // =====================================================================
  load(world, { levelId = null, team = this.team } = {}) {
    this.world = world;
    world.dyn = [];
    this.levelId = levelId;
    this.team = team;
    this.clearLists();
    this.time = 0;
    this.completed = false;
    this.coinsRun = 0;
    this.stats = { kills: 0 };
    this.explored = new Uint8Array(Math.ceil(world.w / 2) * Math.ceil(world.h / 2));
    this.exploredW = Math.ceil(world.w / 2);
    // propiedades dinámicas primero (sólidos dinámicos)
    for (const spec of world.props) {
      const pr = createProp(this, spec);
      if (pr) this.props.push(pr);
    }
    for (const spec of world.enemies) this.spawnEnemy(spec);
    this.checkpoints = world.checkpoints.map((c, i) => ({ x: c.x * TILE + TILE / 2, y: (c.y + 1) * TILE, tx: c.x, ty: c.y, active: false, i }));
    this.signs = world.signs.map((s) => ({ x: s.x * TILE + TILE / 2, y: (s.y + 1) * TILE, text: s.text }));
    for (const a of world.amulets) {
      if (!Store.has(a.type)) this.pickups.push({ kind: 'amulet', type: a.type, x: a.x * TILE + TILE / 2, y: (a.y + 1) * TILE, t: Math.random() * 6, taken: false });
    }
    if (world.exit) this.exitObj = { x: world.exit.x * TILE + TILE / 2, y: (world.exit.y + 1) * TILE, t: 0 };
    this.player = new Player(this, team);
    this.spawn = { x: world.start.x * TILE + TILE / 2, y: (world.start.y + 1) * TILE };
    this.player.placeAt(this.spawn.x, this.spawn.y);
    this.cam.x = clamp(this.player.cx - VIEW_W / 2, 0, Math.max(0, world.pxW - VIEW_W));
    this.cam.y = clamp(this.player.cy - VIEW_H * 0.55, 0, Math.max(0, world.pxH - VIEW_H));
    this.lookY = 0;
    return this;
  }

  spawnEnemy(spec) {
    const e = createEnemy(this, spec);
    if (e) this.enemies.push(e);
    return e;
  }
  addProjectile(p) { this.projectiles.push(p); return p; }
  addZone(o) { const z = new Zone(o); this.zones.push(z); return z; }
  addHitbox(o) {
    const h = { life: 0.1, delay: 0, seen: new Set(), ox: 0, oy: 0, shape: 'rect', ...o };
    h.dir = o.dir ?? (o.owner ? o.owner.facing : 1);
    this.hitboxes.push(h);
    return h;
  }
  after(delay, fn) { this.timers.push({ t: delay, fn }); }
  shake(a, t) { if (a >= this.cam.shakeA || this.cam.shakeT <= 0) { this.cam.shakeA = a; this.cam.shakeT = t; this.cam.shakeM = t; } }
  flash(color, t) { this.cam.flashC = color; this.cam.flashT = t; this.cam.flashM = t; }
  banner(text, secs = 2.6, color = '#fff') { this.banners.push({ text, t: secs, max: secs, color }); }

  // =====================================================================
  //  Consultas
  // =====================================================================
  enemiesNear(x, y, r, pred) {
    const out = [];
    for (const e of this.enemies) {
      if (e.dead || e.untargetable) continue;
      if (pred && !pred(e)) continue;
      const dx = Math.max(e.x - x, 0, x - (e.x + e.w)), dy = Math.max(e.y - y, 0, y - (e.y + e.h));
      if (dx * dx + dy * dy <= r * r) out.push(e);
    }
    return out;
  }
  nearestEnemy(x, y, maxD = 9999, { los = false, pred = null, magic = false } = {}) {
    let best = null, bd = maxD;
    for (const e of this.enemies) {
      if (e.dead || e.untargetable) continue;
      if (pred && !pred(e)) continue;
      const d = Math.hypot(e.cx - x, e.cy - y);
      if (d < bd && (!los || this.world.los(x, y, e.cx, e.cy))) { bd = d; best = e; }
    }
    return best;
  }

  // =====================================================================
  //  Combate
  // =====================================================================
  damageEnemy(e, dmg, info) { return damageEnemy(this, e, dmg, info); }
  hurtPlayer(amount, src) { return this.player.hurt(amount, src); }

  /** Daño de área a enemigos (círculo). info.tumble hace volar a los enemigos girando. */
  blast(x, y, r, dmg, info = {}) {
    let n = 0;
    for (const e of this.enemies) {
      if (e.dead || e.untargetable) continue;
      const dx = Math.max(e.x - x, 0, x - (e.x + e.w)), dy = Math.max(e.y - y, 0, y - (e.y + e.h));
      if (dx * dx + dy * dy > r * r) continue;
      const res = this.damageEnemy(e, dmg, { ...info, from: { x, y }, radial: true, quiet: true });
      if (res.hit) n++;
      if (info.tumble && !e.dead && res.hit) e.startTumble((Math.sign(e.cx - x) || info.dir || 1) * 330, -400);
    }
    return n;
  }
  /** Explosión mágica: daño de área + destruye proyectiles enemigos + efectos. */
  explosion(x, y, r, dmg, info = {}) {
    const n = this.blast(x, y, r, dmg, info);
    for (const p of this.projectiles) {
      if (p.dead || p.team !== 'enemy') continue;
      if (Math.hypot(p.x - x, p.y - y) < r + p.r) p.die(this, true);
    }
    this.fx.burst(x, y, 18, '#ffb36a', r * 1.4, 0.55, 4, 200);
    return n;
  }
  /** Explosión enemiga: daña al jugador si está dentro. */
  enemyBlast(x, y, r, dmg, src = {}) {
    const p = this.player;
    this.fx.ring(x, y, 6, r, 0.35, src.color || '#ff9a3a', 6);
    this.fx.burst(x, y, 16, src.color || '#ff9a3a', r * 3, 0.5, 4, 300);
    this.shake(5, 0.25);
    audio.sfx('boom');
    if (circleRect(x, y, r, p.hurtBox())) return this.hurtPlayer(dmg * CONFIG.enemies.damageMul, { x, y, kind: 'blast', ...src });
    return null;
  }
  /** Golpe enemigo con rectángulo: devuelve el resultado de hurt() si toca. */
  strikePlayer(rect, dmg, src = {}) {
    const hb = this.player.hurtBox();
    if (rect.x < hb.x + hb.w && rect.x + rect.w > hb.x && rect.y < hb.y + hb.h && rect.y + rect.h > hb.y) {
      return this.hurtPlayer(dmg * CONFIG.enemies.damageMul, src);
    }
    return null;
  }
  scareSpiders(x, y, r) {
    for (const e of this.enemies) if (!e.dead && e.onScare && Math.hypot(e.cx - x, e.cy - y) < r) e.onScare(this);
  }
  spawnFireballs(p) {
    const F = CONFIG.amulets.fire;
    const cands = this.enemies.filter((e) => !e.dead && !e.untargetable && Math.hypot(e.cx - p.cx, e.cy - p.cy) < F.seek)
      .sort((a, b) => Math.hypot(a.cx - p.cx, a.cy - p.cy) - Math.hypot(b.cx - p.cx, b.cy - p.cy));
    const angs = [-0.9, -1.57, -2.2];
    for (let i = 0; i < F.balls; i++) {
      const target = cands[i] || null;
      const a0 = target ? Math.atan2(target.cy - p.cy, target.cx - p.cx) : (p.facing > 0 ? angs[i] * 0.4 : Math.PI - angs[i] * 0.4);
      const g = this;
      const pr = new Projectile({
        x: p.cx, y: p.cy - 6, vx: Math.cos(angs[i] + (p.facing < 0 ? Math.PI : 0)) * 420, vy: Math.sin(angs[i]) * 420, r: 9,
        team: 'player', kind: 'fireball', dmg: 0, life: F.life, color: '#ff7a2a', shape: 'fireball', magic: true, owner: p, target,
      });
      pr.noMana = true;
      pr.onUpdate = function (gg, dt) {
        if (this.target && (this.target.dead)) this.target = gg.nearestEnemy(this.x, this.y, F.seek);
        if (this.target && this.age > 0.12) {
          const dx = this.target.cx - this.x, dy = this.target.cy - this.y, d = Math.hypot(dx, dy) || 1;
          const sp = 560;
          this.vx += ((dx / d) * sp - this.vx) * Math.min(1, dt * 7);
          this.vy += ((dy / d) * sp - this.vy) * Math.min(1, dt * 7);
        }
        if (Math.random() < 0.7) gg.fx.dot(this.x, this.y, rrange(-30, 30), rrange(-30, 30), 0.3, '#ffb24a', 3, 0, 'circ');
      };
      pr.onDie = function (gg) {
        gg.explosion(this.x, this.y, F.radius, F.damage, { kind: 'fireball', knock: 280, radial: true, lift: 100, color: '#ff7a2a' });
        gg.fx.ring(this.x, this.y, 6, F.radius, 0.35, '#ff7a2a', 5);
        gg.fx.disc(this.x, this.y, 6, F.radius * 0.8, 0.3, 'rgba(255,150,60,0.7)');
        audio.sfx('explosion');
      };
      pr.info = { kind: 'fireball', dmg: 0, magic: true, quiet: true, knock: 0, from: null };
      this.projectiles.push(pr);
    }
    audio.sfx('fire');
    this.fx.ring(p.cx, p.cy, 8, 50, 0.3, '#ff7a2a', 5);
  }

  // =====================================================================
  //  Eventos del jugador
  // =====================================================================
  onTeamWiped() {
    this.banner('¡Todo el equipo ha caído!', 2.4, '#ff6a6a');
    this.flash('#000000', 0.6);
    this.respawnAtCheckpoint(true);
  }
  respawnAtCheckpoint(full = true) {
    const p = this.player;
    const cp = this.lastCheckpoint;
    const pos = cp || this.spawn;
    if (full) for (const m of p.team) { m.hp = m.maxHp; m.ko = false; }
    p.resetState();
    p.vx = 0; p.vy = 0;
    p.placeAt(pos.x, pos.y);
    p.inv = 1.0;
    p.idx = p.team.findIndex((m) => !m.ko) >= 0 ? (p.m.ko ? p.team.findIndex((m) => !m.ko) : p.idx) : 0;
    for (const e of this.enemies) if (e.dead && !e.temp) e.respawn(this);
    this.projectiles.length = 0;
    this.zones.length = 0;
  }
  activateCheckpoint(c) {
    if (this.lastCheckpoint === c) return;
    this.lastCheckpoint = c;
    c.active = true;
    audio.sfx('checkpoint');
    this.fx.burst(c.x, c.y - 30, 18, '#ffe27a', 220, 0.8, 3, -80);
    this.fx.ring(c.x, c.y - 24, 6, 50, 0.5, '#ffe27a', 4);
    const p = this.player;
    let revived = 0;
    for (const m of p.team) if (m.ko) { m.ko = false; m.hp = Math.ceil(m.maxHp / 2); revived++; }
    this.banner(revived ? 'Punto de guardado · equipo revivido' : 'Punto de guardado', 2);
    this.spawn = { x: c.x, y: c.y };
  }

  // =====================================================================
  //  Paso de simulación
  // =====================================================================
  step(dt = STEP) {
    const inp = this.input.beginStep();
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      this.fx.update(dt * 0.3);
      return;
    }
    this.time += dt;
    this.frame++;
    const w = this.world;
    // temporizadores diferidos
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      t.t -= dt;
      if (t.t <= 0) { this.timers.splice(i, 1); t.fn(this); }
    }
    for (const pr of this.props) pr.update(this, dt);
    const p = this.player;
    p.update(this, inp, dt);
    if (inp.pressed.respawn) this.respawnAtCheckpoint(false);
    for (const e of this.enemies) e.update(this, dt);
    for (const pr of this.projectiles) if (!pr.dead) pr.update(this, dt);
    this.updateHitboxes(dt);
    for (const z of this.zones) z.update(this, dt);
    for (const c of this.coins) c.update(this, dt);
    this.updatePickups(dt);
    this.contactDamage();
    this.fx.update(dt);
    this.updateCamera(dt, inp);
    this.reveal();
    // limpieza
    if (this.projectiles.length) this.projectiles = this.projectiles.filter((x) => !x.dead);
    if (this.coins.length) this.coins = this.coins.filter((x) => !x.dead);
    if (this.zones.length) this.zones = this.zones.filter((x) => !x.dead);
    for (let i = this.enemies.length - 1; i >= 0; i--) if (this.enemies[i].dead && this.enemies[i].temp && this.enemies[i].removeDead) this.enemies.splice(i, 1);
    for (const b of this.banners) b.t -= dt;
    this.banners = this.banners.filter((b) => b.t > 0);
    if (this.cam.shakeT > 0) this.cam.shakeT -= dt;
    if (this.cam.flashT > 0) this.cam.flashT -= dt;
    void w;
  }

  contactDamage() {
    const p = this.player;
    if (p.hidden) return;
    const hb = p.hurtBox();
    const fy = this.fairy;
    for (const e of this.enemies) {
      if (e.dead || e.contact <= 0 || e.stun > 0 || e.morph || e.tumble || e.harmless) continue;
      if (fy && fy.alive && e.provoke && e.provoke.fairy === fy && e.contactCd <= 0) {
        if (Math.abs(e.cx - fy.x) < e.w / 2 + 12 && Math.abs(e.cy - fy.y) < e.h / 2 + 12) { fy.hit(this, e.contact * CONFIG.enemies.damageMul); e.contactCd = 0.6; }
      }
      const r = e.contactRect ? e.contactRect() : e;
      if (!r) continue;
      if (r.x < hb.x + hb.w && r.x + r.w > hb.x && r.y < hb.y + hb.h && r.y + r.h > hb.y) {
        if (e.contactCd > 0) continue;
        const res = p.hurt(e.contact * CONFIG.enemies.damageMul * (e.contactMul || 1), { x: e.cx, y: e.cy, kind: 'contact', e });
        if (res === 'hurt') e.contactCd = 0.4;
        if (res === 'hurt' && e.onHitPlayer) e.onHitPlayer(this);
      }
    }
  }

  updateHitboxes(dt) {
    const hbs = this.hitboxes;
    for (let i = hbs.length - 1; i >= 0; i--) {
      const h = hbs[i];
      if (h.delay > 0) { h.delay -= dt; continue; }
      const o = h.owner;
      const at = h.atFn ? h.atFn() : h.at;
      const cx = (at ? at.x : o.cx + h.dir * h.ox * (h.flipX === false ? 0 : 1) + (h.flipX === false ? h.ox : 0));
      const cy = (at ? at.y : o.cy + h.oy);
      let rect = null;
      if (h.shape === 'rect') rect = { x: cx - h.w / 2, y: cy - h.h / 2, w: h.w, h: h.h };
      const over = (b) => (h.shape === 'rect'
        ? rect.x < b.x + b.w && rect.x + rect.w > b.x && rect.y < b.y + b.h && rect.y + rect.h > b.y
        : circleRect(cx, cy, h.r, b));
      for (const e of this.enemies) {
        if (e.dead || e.untargetable || h.seen.has(e)) continue;
        if (!over(e.hitRect ? e.hitRect() : e)) continue;
        h.seen.add(e);
        const info = { ...h.info, from: { x: o.cx, y: o.cy }, dir: h.dir };
        if (h.shape === 'circle' && info.radial) info.from = { x: cx, y: cy };
        const res = this.damageEnemy(e, info.dmg, info);
        if (h.onHit) h.onHit(e, res);
      }
      if (h.cut) {
        for (const pr of this.projectiles) {
          if (pr.dead || pr.team !== 'enemy' || !pr.cut || pr.sonic || pr.unblockable) continue;
          if (over({ x: pr.x - pr.r, y: pr.y - pr.r, w: pr.r * 2, h: pr.r * 2 })) {
            pr.die(this, true);
            this.fx.burst(pr.x, pr.y, 7, '#ffffff', 160, 0.3, 2.5, 0);
            audio.sfx('hit');
            if (h.onCut) h.onCut(pr);
          }
        }
      }
      if (h.extra) h.extra(h, cx, cy);
      h.life -= dt;
      if (h.life <= 0) hbs.splice(i, 1);
    }
  }

  updatePickups(dt) {
    const p = this.player;
    const hb = p.hurtBox();
    for (const k of this.pickups) {
      if (k.taken) continue;
      k.t += dt;
      if (Math.hypot(p.cx - k.x, p.cy - (k.y - 20)) < 34) {
        k.taken = true;
        Store.give(k.type);
        const a = AMULETS[k.type];
        audio.sfx('pickup');
        this.banner(`¡${a.name}!`, 3.2, a.color);
        this.fx.ring(k.x, k.y - 20, 6, 80, 0.6, a.color, 5);
        this.fx.burst(k.x, k.y - 20, 30, a.color, 300, 0.9, 4, 100);
        p.hurtInv = Math.max(p.hurtInv, 0.2);
        this.fx.text(k.x, k.y - 50, a.desc.split('.')[0], '#fff', 3, 12);
      }
    }
    for (const c of this.checkpoints) {
      if (Math.abs(p.cx - c.x) < 34 && Math.abs(p.cy - (c.y - 24)) < 60) this.activateCheckpoint(c);
    }
    if (this.exitObj) {
      const x = this.exitObj;
      x.t += dt;
      if (!this.completed && Math.abs(p.cx - x.x) < 30 && Math.abs(p.cy - (x.y - 28)) < 52) {
        this.completed = true;
        audio.sfx('exit');
        this.banner('¡Nivel completado!', 4, '#ffe27a');
        this.fx.burst(x.x, x.y - 30, 40, '#ffe27a', 400, 1, 4, 100);
        this.onComplete && this.onComplete(this);
      }
    }
  }

  reveal() {
    const p = this.player, w = this.world;
    const cx = Math.floor(p.cx / TILE / 2), cy = Math.floor(p.cy / TILE / 2);
    const R = 7;
    for (let y = cy - R; y <= cy + R; y++) {
      for (let x = cx - R; x <= cx + R; x++) {
        if (x < 0 || y < 0 || x >= this.exploredW || y >= Math.ceil(w.h / 2)) continue;
        if ((x - cx) ** 2 + (y - cy) ** 2 <= R * R) this.explored[y * this.exploredW + x] = 1;
      }
    }
  }

  updateCamera(dt, inp) {
    const p = this.player, w = this.world, cam = this.cam;
    const look = CONFIG.camera;
    const I = p.in;
    if ((I.y !== 0) && p.onGround && Math.abs(p.vx) < 5) p.lookT += dt; else p.lookT = 0;
    let lookY = 0;
    if (p.lookT >= look.lookDelay) lookY = Math.sign(I.y) * look.lookAmount * VIEW_H;
    this.lookY += (lookY - this.lookY) * Math.min(1, dt * 6);
    const tx = p.cx + p.facing * 40 - VIEW_W / 2;
    const ty = p.cy - VIEW_H * 0.52 + this.lookY;
    cam.x += (tx - cam.x) * Math.min(1, dt * 7);
    cam.y += (ty - cam.y) * Math.min(1, dt * 6);
    cam.x = clamp(cam.x, 0, Math.max(0, w.pxW - VIEW_W));
    cam.y = clamp(cam.y, 0, Math.max(0, w.pxH - VIEW_H));
    if (cam.shakeT > 0) {
      const k = cam.shakeT / (cam.shakeM || 0.3);
      cam.sx = (Math.random() - 0.5) * 2 * cam.shakeA * k;
      cam.sy = (Math.random() - 0.5) * 2 * cam.shakeA * k;
    } else { cam.sx = 0; cam.sy = 0; }
  }

  // =====================================================================
  //  Dibujo
  // =====================================================================
  draw(ctx, alpha = 1) {
    const w = this.world;
    if (!w) return;
    const cam = { x: Math.round(this.cam.x + this.cam.sx), y: Math.round(this.cam.y + this.cam.sy) };
    const t = this.time;
    drawBackground(ctx, w, cam, t);
    drawDecor(ctx, w, cam, t, 'back');
    drawTiles(ctx, w, cam, t);
    for (const pr of this.props) pr.draw(ctx, cam, t, 'back');
    this.drawObjects(ctx, cam, t);
    for (const c of this.coins) c.draw(ctx, cam, t);
    for (const z of this.zones) z.draw(ctx, cam, t);
    for (const e of this.enemies) e.render(ctx, cam, alpha, t);
    for (const pr of this.props) pr.draw(ctx, cam, t, 'front');
    for (const m of this.player.team) m.kit.drawWorld && m.kit.drawWorld(ctx, cam, t, this.player, m === this.player.m);
    this.player.draw(ctx, cam, alpha, t);
    for (const pr of this.projectiles) pr.draw(ctx, cam, t);
    this.fx.draw(ctx, cam);
    drawDecor(ctx, w, cam, t, 'front');
    drawForeground(ctx, w, cam, t);
    if (CONFIG.debug.hitboxes) this.drawDebug(ctx, cam);
    if (this.cam.flashT > 0) {
      ctx.globalAlpha = clamp(this.cam.flashT / this.cam.flashM, 0, 1) * 0.5;
      ctx.fillStyle = this.cam.flashC; ctx.fillRect(0, 0, VIEW_W, VIEW_H); ctx.globalAlpha = 1;
    }
    this.camDraw = cam;
  }

  drawObjects(ctx, cam, t) {
    // puntos de guardado
    for (const c of this.checkpoints) {
      const x = c.x - cam.x, y = c.y - cam.y;
      if (x < -60 || x > VIEW_W + 60) continue;
      ctx.fillStyle = '#4a4a55'; ctx.fillRect(x - 2, y - 52, 4, 52);
      ctx.fillStyle = c.active ? '#ffe27a' : '#8a8a96';
      ctx.beginPath(); ctx.moveTo(x + 2, y - 52); ctx.lineTo(x + 24, y - 44 + Math.sin(t * 4) * 2); ctx.lineTo(x + 2, y - 34); ctx.fill();
      if (c.active) { ctx.fillStyle = 'rgba(255,226,122,0.2)'; ctx.beginPath(); ctx.arc(x, y - 30, 26 + Math.sin(t * 3) * 3, 0, TAU); ctx.fill(); }
    }
    // carteles
    for (const s of this.signs) {
      const x = s.x - cam.x, y = s.y - cam.y;
      if (x < -80 || x > VIEW_W + 80) continue;
      ctx.fillStyle = '#6b4a2c'; ctx.fillRect(x - 3, y - 26, 6, 26);
      ctx.fillStyle = '#9a7040'; ctx.fillRect(x - 15, y - 44, 30, 20);
      ctx.fillStyle = '#4a3018'; ctx.fillRect(x - 15, y - 44, 30, 3);
      ctx.fillStyle = '#e8d8b0'; for (let i = 0; i < 3; i++) ctx.fillRect(x - 10, y - 38 + i * 5, 20 - i * 3, 1.5);
      const p = this.player;
      if (Math.abs(p.cx - s.x) < 80 && Math.abs(p.cy - s.y) < 90) {
        const txt = controls.fill(s.text);
        ctx.font = 'bold 13px system-ui, sans-serif';
        const lines = txt.split('\n');
        const wmax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 18;
        const bx = Math.max(8, Math.min(VIEW_W - wmax - 8, x - wmax / 2)), by = y - 62 - lines.length * 17;
        ctx.fillStyle = 'rgba(10,12,22,0.88)'; ctx.beginPath(); ctx.roundRect(bx, by, wmax, lines.length * 17 + 10, 6); ctx.fill();
        ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
        lines.forEach((l, i) => ctx.fillText(l, bx + 9, by + 20 + i * 17));
      }
    }
    // amuletos
    for (const k of this.pickups) {
      if (k.taken) continue;
      const a = AMULETS[k.type];
      const x = k.x - cam.x, y = k.y - cam.y - 26 + Math.sin(k.t * 3) * 4;
      if (x < -60 || x > VIEW_W + 60) continue;
      ctx.fillStyle = a.color; ctx.globalAlpha = 0.22;
      ctx.beginPath(); ctx.arc(x, y, 26 + Math.sin(k.t * 4) * 3, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = a.color; ctx.beginPath();
      for (let i = 0; i < 8; i++) { const an = (i / 8) * TAU + k.t; const r = i % 2 ? 7 : 13; ctx.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill();
    }
    // salida / portal
    if (this.exitObj) {
      const x = this.exitObj.x - cam.x, y = this.exitObj.y - cam.y;
      if (x > -80 && x < VIEW_W + 80) {
        const tt = this.exitObj.t;
        ctx.save(); ctx.translate(x, y - 32);
        const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 44);
        g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.5, 'rgba(160,120,255,0.7)'); g.addColorStop(1, 'rgba(100,60,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 30, 42, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#d0b8ff'; ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, 0, 14 + i * 7, 22 + i * 7, tt * (i % 2 ? 1 : -1), 0, Math.PI * 1.4); ctx.stroke(); }
        ctx.restore();
      }
    }
  }

  drawDebug(ctx, cam) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,0,0.8)'; ctx.lineWidth = 1;
    for (const h of this.hitboxes) {
      if (h.delay > 0) continue;
      const o = h.owner;
      const at = h.atFn ? h.atFn() : h.at;
      const cx = at ? at.x : o.cx + h.dir * h.ox, cy = at ? at.y : o.cy + h.oy;
      if (h.shape === 'rect') ctx.strokeRect(cx - h.w / 2 - cam.x, cy - h.h / 2 - cam.y, h.w, h.h);
      else { ctx.beginPath(); ctx.arc(cx - cam.x, cy - cam.y, h.r, 0, TAU); ctx.stroke(); }
    }
    ctx.strokeStyle = 'rgba(80,160,255,0.7)';
    for (const d of this.world.dyn) ctx.strokeRect(d.x - cam.x, d.y - cam.y, d.w, d.h);
    ctx.restore();
  }
}
