// Reglas de daño: etiquetas de tipo de golpe, inmunidades, esquivas, hilos, agua y maná.
import { CONFIG } from './config.js';
import { chance } from './util.js';
import { Store } from './storage.js';

// Golpes cuerpo a cuerpo (cuentan para el amuleto de los Hilos; los proyectiles no).
export const MELEE = new Set(['sword', 'chain', 'puppet', 'whip', 'wrench', 'echo', 'spin']);
// Magia: espada y escudo no la tocan, pero daña fantasmas. (chispas, mariposas, hada, proyectiles mágicos, explosión, fuego)
export const MAGIC = new Set(['bolt', 'charged', 'spark', 'butterfly', 'fairy', 'explosion', 'fireball']);
// Lo único que daña a un fantasma.
export const GHOST_OK = new Set([...MAGIC, 'bomb']);
// Daños que la armadura viviente no puede contraatacar.
export const ARMOR_SAFE = new Set([
  'explosion', 'fireball', 'bomb', 'assault', 'heroic', 'highwave', 'earthwave', 'quake', 'windsprint',
  'flask', 'acid', 'vapor', 'skate', 'rocket', 'tumble', 'threads', 'wave',
]);
export const FIRE_KINDS = new Set(['fireball']);

export function hasAmulet(name) {
  return Store.equipped(name);
}

/**
 * Aplica un golpe del jugador a un enemigo. Devuelve { hit, dmg, killed, parried, dodged, immune, countered }.
 * info: { kind, melee, magic, knock, dir, stun, mana, hitstop, from:{x,y}, canParry, src }
 */
export function damageEnemy(g, e, dmg, info) {
  const res = { hit: false, dmg: 0, killed: false };
  if (!e || e.dead || e.untargetable) return res;
  const kind = info.kind || 'hit';
  info.melee = info.melee ?? MELEE.has(kind);
  info.magic = info.magic ?? MAGIC.has(kind);

  // 1) fantasmas: solo magia, explosión, bolas de fuego y bombas
  if (e.ghost && !GHOST_OK.has(kind)) {
    if (!info.quiet) g.fx.text(e.cx, e.y - 6, 'inmune', '#bfc8ff', 0.6, 11);
    res.immune = true;
    return res;
  }
  // 2) parry
  if (info.canParry && e.parryActive && e.parryActive()) {
    e.onParried(g, info);
    g.player.addMana(1);
    g.fx.ring(e.cx, e.cy, 8, 46, 0.3, '#ffffff', 4);
    g.fx.burst(e.cx, e.cy, 10, '#fff7b0', 220, 0.4, 3, 0);
    g.audio.sfx('parry');
    g.shake(3, 0.12);
    g.hitStop = Math.max(g.hitStop, 0.07);
    res.parried = true;
    res.hit = true;
    return res;
  }
  // 3) hook propio del enemigo (armadura que contraataca, caja del payaso, araña escondida…)
  if (e.preHit) {
    const r = e.preHit(g, info, dmg);
    if (r) { Object.assign(res, r); if (r.cancel) return res; }
  }
  // 4) esquivas
  if (e.dodge > 0 && !(e.noDodge && e.noDodge.has(kind)) && !info.noDodge && chance(e.dodge)) {
    g.fx.text(e.cx, e.y - 6, '¡esquiva!', '#ffe9a0', 0.6, 11);
    e.onDodge && e.onDodge(g, info);
    res.dodged = true;
    return res;
  }

  let d = dmg;
  // 5) hilos
  if (info.melee && hasAmulet('threads')) {
    const th = CONFIG.amulets.threads;
    if (e.thread > 0) {
      d *= 1 + th.bonus;
      g.player.addMana(th.mana);
      g.fx.text(e.cx, e.y - 14, 'HILO', '#e0b3ff', 0.7, 11);
      g.fx.line(e.cx - 16, e.cy - 14, e.cx + 16, e.cy + 14, 0.25, '#e8c6ff', 2);
      res.thread = true;
    }
    e.thread = th.time;
  }
  // 6) agua / fuego
  if (kind === 'charged' && hasAmulet('water')) {
    d *= CONFIG.amulets.water.mul;
    if (e.fire) d *= CONFIG.amulets.water.fireMul;
    info.water = true;
  }
  // 7) multiplicadores del jugador (piel etérea…) y del enemigo
  d *= g.player.damageMul(info);
  if (e.takeMul) d *= e.takeMul(info);
  d = Math.round(d * 10) / 10;

  res.hit = true;
  res.dmg = d;
  e.hp -= d;
  e.flash = 0.12;
  e.hurtT = 1.2;
  if (g.cfgDamageNumbers) g.fx.text(e.cx, e.y - 4, String(Math.round(d)), '#fff', 0.5, 11);

  // 8) retroceso / aturdimiento
  const fromX = info.from ? info.from.x : e.cx - (info.dir || 1) * 10;
  const dirx = info.radial ? (Math.sign(e.cx - fromX) || info.dir || 1) : (info.dir || Math.sign(e.cx - fromX) || 1);
  if (!e.heavy && !e.noKnock && info.knock) {
    const k = info.knock * (e.knockMul ?? 1);
    e.vx = dirx * k;
    if (info.lift) e.vy = -info.lift;
    else if (!e.flies && e.onGround) e.vy = -120;
  }
  if (info.stun && !e.noStun) e.stun = Math.max(e.stun || 0, info.stun);
  if (info.mana) g.player.addMana(info.mana);
  if (info.hitstop) g.hitStop = Math.max(g.hitStop, info.hitstop);

  // 9) 5 % de transformar en rana/ratón con chispas
  if (kind === 'spark' && e.canMorph !== false && !e.dead && e.hp > 0 && chance(CONFIG.mage.morphChance) && !e.morph) {
    e.morphInto(g);
    res.morphed = true;
  }

  g.fx.burst(info.from ? (e.cx + info.from.x) / 2 : e.cx, info.from ? (e.cy + info.from.y) / 2 : e.cy, 5, info.color || '#ffffff', 170, 0.28, 2.5, 200);
  g.audio.sfx('hit');
  if (e.onDamaged) e.onDamaged(g, info, d);

  if (e.hp <= 0 && !e.dead) {
    res.killed = true;
    e.kill(g, info);
  }
  return res;
}
