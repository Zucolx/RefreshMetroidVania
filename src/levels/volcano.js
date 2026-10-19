// Volcán: galerías (ruta principal, techos bajos) · chimenea (torre ancha con escalinata) · pozos de lava. Amuleto de Fuego arriba.
import { LevelBuilder } from './builder.js';

export function buildVolcano() {
  const b = new LevelBuilder({ w: 208, h: 60, theme: 'volcano', name: 'Volcán', seed: 31 });
  const GAL = [['flat', 3], ['low', 3], ['lavapit', 2], ['up', 1], ['down', 1], ['stairsUp', 1], ['stairsDown', 1], ['spikes', 1], ['hops', 1], ['arena', 1]];
  const CHI = [['flat', 3], ['platRow', 2], ['lavapit', 2], ['hops', 1], ['spikes', 1]];
  const POZ = [['flat', 2], ['hops', 3], ['lavapit', 2], ['low', 1], ['up', 1], ['down', 1]];
  const G = b.band('G', { x0: 4, x1: 204, base: 36, ceil: 11, table: GAL, pitHz: 'lava', hopHz: 'lava' });
  const C = b.band('C', { x0: 44, x1: 176, base: 18, ceil: 10, table: CHI, pitHz: 'lava', hopHz: 'lava' });
  const P = b.band('P', { x0: 50, x1: 190, base: 54, ceil: 9, table: POZ, pitHz: 'lava', hopHz: 'lava' });

  G.flat(18);
  G.slot(62, 6); G.slot(86, 6); G.slot(110, 10); G.slot(150, 6);
  G.fillTo(200).flat(4);
  C.slot(62, 6); C.slot(110, 10);
  C.fillTo(176);
  P.slot(86, 6); P.slot(150, 6);
  P.fillTo(190);

  b.shaft(C, G, 62, 6);
  b.shaft(G, P, 86, 6, { cover: true });
  b.shaft(C, G, 110, 10);        // la chimenea: torre ancha con escalinata diagonal
  b.shaft(G, P, 150, 6, { cover: true });

  b.finish();
  b.setStart('G', 8);
  b.setExit('G', 198);
  b.addAmulet('fire', 'C', 168);
  b.addCheckpoint('G', 50); b.addCheckpoint('G', 98); b.addCheckpoint('G', 135); b.addCheckpoint('G', 180);
  b.addCheckpoint('C', 90); b.addCheckpoint('P', 120);
  b.addSign('G', 12, 'El volcán: la lava y los pinchos te\ndevuelven al último suelo seguro.\nLos gólems explotan 2 s después de morir.');
  b.addSign('G', 100, 'La chimenea: sube por la torre ancha;\nfalla un salto y caes al escalón de abajo.');
  b.addSign('C', 160, 'Amuleto de Fuego: la explosión\nlanza 3 bolas de fuego que persiguen.');

  b.populate('G', { table: [['lizard', 3], ['hyena', 2], ['golem', 2]], density: 0.11, from: 20 });
  b.populate('C', { table: [['lizard', 2], ['hyena', 1]], density: 0.09 });
  b.populate('P', { table: [['lizard', 2], ['golem', 1]], density: 0.08 });
  b.decorate('G', { table: [['vent', 3], ['tombstone', 1], ['barrel', 1]], density: 0.2 });
  b.decorate('C', { table: [['vent', 3]], density: 0.15 });
  b.decorate('P', { table: [['vent', 2], ['crystal', 1]], density: 0.12 });
  return b.build();
}
