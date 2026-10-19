// Configuración central. Unidades: 1 tile = 32 px · px/s · segundos · bucle fijo 60 Hz.
// Todo lo que aparece en TUNABLES se puede ajustar en vivo desde el laboratorio (Tab).

import { deepClone, getPath, setPath } from './util.js';

export const TILE = 32;
export const STEP = 1 / 60;
export const VIEW_W = 960;
export const VIEW_H = 540;

export const CONFIG = {
  // --- física base ---
  gravity: 2400,
  maxFall: 1100,
  runSpeed: 300,
  accelGround: 3200,
  accelAir: 2200,

  // --- salto ---
  jumpForce: 760,
  jumpCut: 0.45,
  coyote: 0.1,
  jumpBuffer: 0.12,
  doubleJumpForce: 700,
  glideFall: 80,

  // --- salto alto (↑ + mantener salto) ---
  highJump: {
    mode: 'up', // 'up' | 'down' | 'hold'
    t1: 1, f1: 950,
    t2: 2, f2: 1300,
    waveRadius: 170, waveDamage: 30, wavePush: 520,
  },

  // --- dash / sprint ---
  dash: { speed: 900, duration: 0.18, cooldown: 0.45, airDashes: 1, invuln: true },
  sprint: {
    speedMul: 1.35, jumpMul: 1.12, doubleJumpMul: 1.08,
    skid: 0.18, loseTime: 0.15, maxRatio: 0.9,
    skateSpeed: 660, rocketSpeed: 680,
    skateWaveRadius: 120, skateWaveDamage: 20,
    rocketRadius: 95, rocketDamage: 30,
    tumbleTime: 1.2, tumbleDamage: 15,
  },

  // --- cámara / daño ---
  camera: { lookDelay: 0.2, lookAmount: 0.35 },
  invulnTime: 1,
  knockback: 320,

  // --- equipo ---
  team: { switchCooldown: 3, reserveRegen: 2, entryInvuln: 1.2, chargeStart: 0.3 },
  characters: {
    swordsman: { hp: 100 },
    mage: { hp: 85 },
    artificer: { hp: 110 },
    alchemist: { hp: 90 },
    puppeteer: { hp: 95 },
    clockmaker: { hp: 85 },
  },

  // --- maná / meditación / idles ---
  mana: { max: 15, regenMove: 0.25, regenStill: 1.5, stillDelay: 0.4, mageBonus: 1.3 },
  meditationEnabled: true,
  meditation: { wait: 3, mana: 3, hp: 10 },
  idle: { flavorWait: 4, blend: 0.2, flavorTime: 5 },

  // --- magia común ---
  magic: {
    boltCost: 1, boltDamage: 15, boltSpeed: 760,
    chargedCost: 3, chargedTime: 0.6, chargedDamage: 45, chargedSpeed: 620,
    shieldCost: 5, shieldTime: 4, shieldRadius: 42,
    explosionCost: 5, explosionDamage: 70, explosionRadius: 180,
  },

  // --- amuletos ---
  amulets: {
    water: { mul: 1.6, fireMul: 1.25 },
    fire: { balls: 3, damage: 35, radius: 108, seek: 600, life: 2.4 },
    earth: { passDamage: 6, waveRadius: 140, waveDamage: 25, waveExtra: 20, shieldBonus: 2, shieldWaveRadius: 230, shieldWaveDamage: 45, quakeTime: 2, quakeDps: 15, quakeRadius: 280 },
    wind: { dashSpeed: 1.25, dashTime: 1.2, extraAirDash: 1, chargeEvery: 0.8, maxCharges: 3, perCharge: 0.15, pierceDamage: 8 },
    threads: { time: 2, bonus: 0.4, mana: 0.5 },
  },

  // --- personajes ---
  sword: {
    dmg1: 12, dmg2: 12, dmg3: 20, reach: 64, push: 260, mana: 0.5, hitstop: 0.05, window: 0.35,
    moonTime: 0.9, moonDamage: 40, moonSpeed: 720, moonRange: 560,
    pogoDamage: 14, pogoForce: 720,
    shieldHold: 5, shieldRecharge: 0.8, shieldThrowMin: 1, shieldSpeed: 780, shieldBounces: 3, shieldDamage: 28, shieldReturnDamage: 14, shieldLeg: 400,
    entryDamage: 22, entryRadius: 180,
  },
  mage: {
    sparkDmg1: 9, sparkDmg2: 9, sparkDmg3: 15, sparkSpeed: 660, sparkRange: 270, sparkGap: 0.2, morphChance: 0.05,
    butterflyTime: 0.9, butterflies: 7, butterflyDamage: 10,
    gustDamage: 8, gustRadius: 100,
    windLiftForce: 900, windLiftReach: 170, windLiftDamage: 8,
    fairyTime: 15, fairyHp: 30, fairyRecharge: 5, fairyDownRecharge: 7, fairyDamage: 8, fairyCall: 2.5,
    trailEvery: 0.08, trailMax: 8, trailDamage: 10,
  },
  artificer: {
    dmg1: 10, dmg2: 10, dmg3: 16, reach: 112,
    shotTime: 0.35, pellets: 7, pelletDamage: 7, shotRange: 300, shotRecoil: 360, shotLift: 560, shotSlow: 0.3,
    bombDamage: 22, bombRadius: 72, bombBoost: 840, bombGap: 0.35,
    hookSpeed: 1600, hookRange: 360, hookGap: 0.25, wallPull: 1250, hookHang: 1.4, lightPull: 1050, throwBombDamage: 18, heavyAssault: 1150, assaultDamage: 28,
    entryDamage: 20,
  },
  alchemist: {
    flaskDamage: 8, flaskRadius: 24, flask3Damage: 14, flask3Radius: 40, combo: 0.24,
    acidTime: 0.9, acidDamage: 10, acidRadius: 40, puddleRadius: 96, puddleTime: 4, puddleDps: 3,
    unstableDamage: 12, unstableRadius: 40, unstableBoost: 800, unstableSpike: 1200, unstableGap: 0.3,
    transTime: 4, transRecharge: 5, stoneDamageMul: 0.5, stoneSpeed: 0.8, etherDamageMul: 1.5,
    vaporEvery: 0.06, vaporLife: 1.5, vaporDamage: 4, vaporSlow: 0.5,
    entryDamage: 18, entryRadius: 85,
  },
  puppeteer: {
    dmg1: 10, dmg2: 10, dmg3: 16, reach: 90, reach3: 110,
    whirlTime: 0.8, whirlDamage: 18, whirlRadius: 100,
    diveSpeed: 1500, diveReach: 150, diveBounce: 760, diveDamage: 12, diveSpike: 1.3,
    swapRecharge: 2, swapSpeed: 900, swapReach: 220, swapDamage: 12, swapRadius: 50,
    cutDamage: 15, cutStun: 0.5, entryDamage: 16, entryRadius: 110,
  },
  clockmaker: {
    dmg1: 10, dmg2: 10, dmg3: 16, reach: 58, reach3: 68, push: 220, echoDelay: 0.3,
    bubbleTime: 0.8, bubbleDamage: 14, bubbleRadius: 90, bubbleLife: 1.2, bubbleSlow: 0.5,
    needleReach: 70, needleForce: 740, needleDamage: 12,
    markTime: 4, markRecharge: 6, markInvuln: 0.5,
    stasisLife: 2, stasisSlow: 0.5, stasisTime: 1.5,
    entrySlow: 0.35, entryRadius: 200,
  },

  // --- enemigos ---
  enemies: { damageMul: 1, speedMul: 1, hpMul: 1, respawn: true, respawnTime: 6, frozen: false },

  // --- monedas ---
  coins: { enabled: true, mul: 1, magnet: 110, life: 20, magnetDelay: 0.35 },

  // --- varios del laboratorio ---
  cheats: { invincible: false, infiniteMana: false },
  debug: { hitboxes: false },
  render: { mode: 'shapes' }, // 'shapes' | 'sprites' | 'mixed'
};

export const DEFAULTS = deepClone(CONFIG);

/** Parámetros con deslizador en el laboratorio. */
export const TUNABLES = [
  { group: 'Física', path: 'gravity', label: 'Gravedad', min: 800, max: 4000, step: 50 },
  { group: 'Física', path: 'maxFall', label: 'Caída máxima', min: 400, max: 2000, step: 50 },
  { group: 'Física', path: 'runSpeed', label: 'Velocidad de carrera', min: 120, max: 600, step: 10 },
  { group: 'Física', path: 'accelGround', label: 'Aceleración suelo', min: 500, max: 8000, step: 100 },
  { group: 'Física', path: 'accelAir', label: 'Aceleración aire', min: 500, max: 8000, step: 100 },
  { group: 'Salto', path: 'jumpForce', label: 'Fuerza de salto', min: 300, max: 1200, step: 10 },
  { group: 'Salto', path: 'jumpCut', label: 'Corte al soltar', min: 0.1, max: 1, step: 0.05 },
  { group: 'Salto', path: 'coyote', label: 'Coyote (s)', min: 0, max: 0.4, step: 0.01 },
  { group: 'Salto', path: 'jumpBuffer', label: 'Buffer (s)', min: 0, max: 0.4, step: 0.01 },
  { group: 'Salto', path: 'doubleJumpForce', label: 'Doble salto', min: 300, max: 1200, step: 10 },
  { group: 'Salto alto', path: 'highJump.t1', label: 'Carga 1 (s)', min: 0.2, max: 3, step: 0.1 },
  { group: 'Salto alto', path: 'highJump.f1', label: 'Fuerza 1', min: 600, max: 1600, step: 10 },
  { group: 'Salto alto', path: 'highJump.t2', label: 'Carga 2 (s)', min: 0.5, max: 4, step: 0.1 },
  { group: 'Salto alto', path: 'highJump.f2', label: 'Fuerza 2', min: 800, max: 2000, step: 10 },
  { group: 'Salto alto', path: 'highJump.waveRadius', label: 'Onda: radio', min: 50, max: 400, step: 5 },
  { group: 'Salto alto', path: 'highJump.waveDamage', label: 'Onda: daño', min: 0, max: 200, step: 1 },
  { group: 'Dash', path: 'dash.speed', label: 'Velocidad dash', min: 300, max: 1800, step: 25 },
  { group: 'Dash', path: 'dash.duration', label: 'Duración (s)', min: 0.05, max: 0.6, step: 0.01 },
  { group: 'Dash', path: 'dash.cooldown', label: 'Cooldown (s)', min: 0, max: 2, step: 0.05 },
  { group: 'Dash', path: 'dash.airDashes', label: 'Dashes aéreos', min: 0, max: 4, step: 1 },
  { group: 'Dash', path: 'sprint.speedMul', label: 'Sprint ×vel', min: 1, max: 2.5, step: 0.05 },
  { group: 'Espada', path: 'sword.reach', label: 'Alcance', min: 20, max: 200, step: 2 },
  { group: 'Espada', path: 'sword.dmg1', label: 'Daño tajo 1', min: 1, max: 100, step: 1 },
  { group: 'Espada', path: 'sword.dmg3', label: 'Daño giro', min: 1, max: 100, step: 1 },
  { group: 'Espada', path: 'sword.moonDamage', label: 'Media luna: daño', min: 1, max: 200, step: 1 },
  { group: 'Magia', path: 'mana.max', label: 'Maná máximo', min: 5, max: 60, step: 1 },
  { group: 'Magia', path: 'mana.regenMove', label: 'Regen. moviéndose', min: 0, max: 5, step: 0.05 },
  { group: 'Magia', path: 'mana.regenStill', label: 'Regen. quieto', min: 0, max: 8, step: 0.1 },
  { group: 'Magia', path: 'magic.boltDamage', label: 'Proyectil: daño', min: 1, max: 100, step: 1 },
  { group: 'Magia', path: 'magic.chargedDamage', label: 'Cargado: daño', min: 1, max: 200, step: 1 },
  { group: 'Magia', path: 'magic.explosionDamage', label: 'Explosión: daño', min: 1, max: 300, step: 1 },
  { group: 'Magia', path: 'magic.shieldTime', label: 'Escudo (s)', min: 1, max: 15, step: 0.5 },
  { group: 'Meditación', path: 'meditation.wait', label: 'Espera (s)', min: 0.5, max: 10, step: 0.5 },
  { group: 'Meditación', path: 'meditation.hp', label: 'HP/s', min: 0, max: 60, step: 1 },
  { group: 'Meditación', path: 'meditation.mana', label: 'Maná/s', min: 0, max: 20, step: 0.5 },
  { group: 'Idles', path: 'idle.flavorWait', label: 'Espera idle sabor (s)', min: 1, max: 15, step: 0.5 },
  { group: 'Enemigos', path: 'enemies.damageMul', label: 'Daño ×', min: 0, max: 5, step: 0.1 },
  { group: 'Enemigos', path: 'enemies.speedMul', label: 'Velocidad ×', min: 0.2, max: 3, step: 0.1 },
  { group: 'Enemigos', path: 'enemies.hpMul', label: 'Vida ×', min: 0.1, max: 10, step: 0.1 },
  { group: 'Enemigos', path: 'enemies.respawnTime', label: 'Reaparición (s)', min: 1, max: 60, step: 1 },
  { group: 'Monedas', path: 'coins.mul', label: 'Multiplicador', min: 0, max: 10, step: 0.5 },
  { group: 'Monedas', path: 'coins.magnet', label: 'Radio imán', min: 0, max: 400, step: 10 },
  { group: 'Monedas', path: 'coins.life', label: 'Duración (s)', min: 2, max: 120, step: 1 },
];

/** Toggles booleanos del laboratorio. */
export const TOGGLES = [
  { path: 'cheats.invincible', label: 'Invencible' },
  { path: 'cheats.infiniteMana', label: 'Maná infinito' },
  { path: 'debug.hitboxes', label: 'Mostrar hitboxes' },
  { path: 'enemies.frozen', label: 'Congelar enemigos' },
  { path: 'enemies.respawn', label: 'Reaparición de enemigos' },
  { path: 'coins.enabled', label: 'Soltar monedas' },
  { path: 'meditationEnabled', label: 'Meditación' },
  { path: 'dash.invuln', label: 'Dash invulnerable' },
];

export function getConfig(path) {
  return getPath(CONFIG, path);
}
export function setConfig(path, v) {
  setPath(CONFIG, path, v);
}
/** Devuelve solo lo que difiere de los valores por defecto. */
export function configOverrides() {
  const out = {};
  const walk = (cur, def, prefix) => {
    for (const k of Object.keys(def)) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (def[k] && typeof def[k] === 'object') walk(cur[k], def[k], p);
      else if (cur[k] !== def[k]) out[p] = cur[k];
    }
  };
  walk(CONFIG, DEFAULTS, '');
  return out;
}
export function applyOverrides(o) {
  for (const [p, v] of Object.entries(o || {})) {
    try {
      if (getPath(DEFAULTS, p) !== undefined) setPath(CONFIG, p, v);
    } catch (e) { /* clave obsoleta */ }
  }
}
export function resetConfig() {
  const walk = (cur, def) => {
    for (const k of Object.keys(def)) {
      if (def[k] && typeof def[k] === 'object') walk(cur[k], def[k]);
      else cur[k] = def[k];
    }
  };
  walk(CONFIG, DEFAULTS);
}
