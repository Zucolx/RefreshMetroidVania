// Registro de personajes. Para añadir uno: crear su clase (extiende Kit), importarla aquí,
// añadirla a KITS y KIT_ORDER y poner su vida en CONFIG.characters.
import { Swordsman } from './swordsman.js';
import { Mage } from './mage.js';
import { Artificer } from './artificer.js';
import { Alchemist } from './alchemist.js';
import { Puppeteer } from './puppeteer.js';
import { Clockmaker } from './clockmaker.js';

export const KITS = {
  swordsman: Swordsman,
  mage: Mage,
  artificer: Artificer,
  alchemist: Alchemist,
  puppeteer: Puppeteer,
  clockmaker: Clockmaker,
};

export const KIT_ORDER = ['swordsman', 'mage', 'artificer', 'alchemist', 'puppeteer', 'clockmaker'];

export function createKit(id) {
  const K = KITS[id];
  if (!K) throw new Error('Personaje desconocido: ' + id);
  return new K();
}
