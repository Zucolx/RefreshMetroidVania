// Registro de enemigos. Para añadir uno: crear la clase (extiende Enemy con static def), importarla y registrarla aquí.
import { Patrol, Chaser, Shooter } from './basic.js';
import { Spider, Spiderling, Treant, WhiteFairy } from './forest.js';
import { Lizard, Golem, FireHyena } from './volcano.js';
import { Wolf, BlackFairy, Orc } from './valley.js';
import { Bat, Ghost, Armor } from './castle.js';
import { Marionette, Shadow, Mask, Clown } from './theater.js';

// biome: agrupa la paleta del editor; ceil: se ancla al techo; fly: vuela
export const ENEMY_TYPES = {
  patrol: Patrol, chaser: Chaser, shooter: Shooter,
  spider: Spider, spiderling: Spiderling, treant: Treant, whitefairy: WhiteFairy,
  lizard: Lizard, golem: Golem, hyena: FireHyena,
  wolf: Wolf, blackfairy: BlackFairy, orc: Orc,
  bat: Bat, ghost: Ghost, armor: Armor,
  marionette: Marionette, shadow: Shadow, mask: Mask, clown: Clown,
};

export const ENEMY_META = {
  patrol: { biome: 'Laboratorio', label: 'Patrullero', color: '#6fb8c9' },
  chaser: { biome: 'Laboratorio', label: 'Perseguidor', color: '#d98a4a' },
  shooter: { biome: 'Laboratorio', label: 'Tirador', color: '#9a8ad9' },
  spider: { biome: 'Bosque', label: 'Araña', color: '#7a5aa0', ceil: true },
  treant: { biome: 'Bosque', label: 'Arbusto-treant', color: '#3f7a3a' },
  whitefairy: { biome: 'Bosque', label: 'Hada blanca', color: '#e8f4ff', fly: true },
  lizard: { biome: 'Volcán', label: 'Lagarto de fuego', color: '#d9532a' },
  golem: { biome: 'Volcán', label: 'Gólem', color: '#8a6a50' },
  hyena: { biome: 'Volcán', label: 'Hiena de fuego', color: '#c46a2a' },
  wolf: { biome: 'Valle', label: 'Lobo', color: '#8a8a9a' },
  blackfairy: { biome: 'Valle', label: 'Hada negra', color: '#3a2450', fly: true },
  orc: { biome: 'Valle', label: 'Orco', color: '#8aa87a' },
  bat: { biome: 'Castillo', label: 'Murciélago', color: '#5a4a7a', ceil: true },
  ghost: { biome: 'Castillo', label: 'Fantasma', color: '#c8d0ff', fly: true },
  armor: { biome: 'Castillo', label: 'Armadura viviente', color: '#7a7e92' },
  marionette: { biome: 'Teatro', label: 'Marioneta sin hilos', color: '#c9a070' },
  shadow: { biome: 'Teatro', label: 'Actor sombra', color: '#2a2438' },
  mask: { biome: 'Teatro', label: 'Máscara risueña', color: '#f0e0c0', fly: true },
  clown: { biome: 'Teatro', label: 'Payaso de resorte', color: '#d9534f' },
};

export function createEnemy(g, spec) {
  const C = ENEMY_TYPES[spec.type];
  return C ? new C(g, spec) : null;
}
