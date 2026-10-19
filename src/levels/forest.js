// Bosque: copas (arriba) · superficie (ruta principal) · cuevas (abajo). Amuleto de Agua en las cuevas.
import { LevelBuilder } from './builder.js';

export function buildForest() {
  const b = new LevelBuilder({ w: 204, h: 60, theme: 'forest', name: 'Bosque', seed: 21 });
  const SURF = [['flat', 4], ['up', 1], ['down', 1], ['stairsUp', 1], ['stairsDown', 1], ['pit', 1], ['spikes', 1], ['platRow', 1], ['arena', 1]];
  const CAN = [['flat', 3], ['platRow', 2], ['pit', 2], ['spikes', 1], ['hops', 1]];
  const CAVE = [['flat', 3], ['low', 2], ['pit', 2], ['spikes', 1], ['up', 1], ['down', 1], ['arena', 1]];
  const S = b.band('S', { x0: 4, x1: 200, base: 36, ceil: 11, table: SURF, pitHz: 'spike' });
  const C = b.band('C', { x0: 40, x1: 172, base: 18, ceil: 10, table: CAN, hopHz: 'spike' });
  const U = b.band('U', { x0: 40, x1: 184, base: 54, ceil: 9, table: CAVE });

  S.flat(18);
  S.slot(58, 6); S.slot(98, 6); S.slot(140, 6); S.slot(160, 6);
  S.fillTo(196).flat(4);
  C.slot(58, 6); C.slot(140, 6);
  C.fillTo(172);
  U.slot(98, 6); U.slot(160, 6);
  U.fillTo(184);

  b.shaft(C, S, 58, 6);
  b.shaft(S, U, 98, 6, { cover: true });
  b.shaft(C, S, 140, 6);
  b.shaft(S, U, 160, 6, { cover: true });

  b.finish();
  b.setStart('S', 8);
  b.setExit('S', 194);
  b.addAmulet('water', 'U', 178);
  b.addCheckpoint('S', 50); b.addCheckpoint('S', 120); b.addCheckpoint('S', 178);
  b.addCheckpoint('C', 100); b.addCheckpoint('U', 130);
  b.addSign('S', 12, 'El bosque: arañas en el techo,\nhadas que cantan y arbustos que despiertan.\nEl escudo (↓ + {magic}) devuelve las bayas.');
  b.addSign('S', 52, 'Pozos con escalera de plataformas:\nsube por ellos a las copas o baja a las cuevas.');
  b.addSign('U', 170, 'Amuleto de Agua: el proyectil\ncargado (mantén {magic}) causa ×1,6.');

  b.populate('S', { table: [['treant', 3]], ceil: [['spider', 1]], air: [['whitefairy', 1]], density: 0.045, ceilDensity: 0.03, airDensity: 0.02, from: 20 });
  b.populate('C', { table: [['treant', 1]], ceil: [['spider', 1]], air: [['whitefairy', 1]], density: 0.03, ceilDensity: 0.03, airDensity: 0.03 });
  b.populate('U', { table: [['treant', 2]], ceil: [['spider', 2]], air: [['whitefairy', 1]], density: 0.04, ceilDensity: 0.05, airDensity: 0.02 });
  b.decorate('S', { table: [['tree', 4], ['bush', 3], ['mushroom', 2], ['fence', 1]], density: 0.28 });
  b.decorate('C', { table: [['tree', 2], ['bush', 3], ['mushroom', 3]], density: 0.2 });
  b.decorate('U', { table: [['mushroom', 4], ['crystal', 3], ['bush', 1]], density: 0.25 });
  return b.build();
}
