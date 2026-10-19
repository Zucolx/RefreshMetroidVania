// Valle: aldea (superficie) · tejados · catacumbas · túnel. Amuleto de Tierra en las catacumbas.
import { LevelBuilder } from './builder.js';

export function buildValley() {
  const b = new LevelBuilder({ w: 208, h: 60, theme: 'valley', name: 'Valle', seed: 41 });
  const ALD = [['flat', 4], ['up', 1], ['down', 1], ['stairsUp', 1], ['stairsDown', 1], ['pit', 1], ['spikes', 1], ['arena', 1]];
  const TEJ = [['flat', 2], ['platRow', 3], ['pit', 2], ['up', 1], ['down', 1]];
  const CAT = [['flat', 3], ['low', 3], ['pit', 2], ['spikes', 1], ['up', 1], ['down', 1], ['arena', 1]];
  const V = b.band('V', { x0: 4, x1: 204, base: 36, ceil: 11, table: ALD, pitHz: 'spike' });
  const R = b.band('R', { x0: 40, x1: 170, base: 18, ceil: 10, table: TEJ, pitHz: 'spike', hopHz: 'spike' });
  const K = b.band('K', { x0: 36, x1: 186, base: 54, ceil: 9, table: CAT, pitHz: 'spike' });

  V.flat(20);
  V.slot(56, 6); V.slot(92, 6);
  V.flat(2).lowceil(30, 3).flat(2);          // el túnel
  V.slot(150, 6); V.slot(168, 6);
  V.fillTo(200).flat(4);
  R.slot(56, 6); R.slot(150, 6);
  R.fillTo(170);
  K.slot(92, 6); K.slot(168, 6);
  K.fillTo(186);

  b.shaft(R, V, 56, 6);
  b.shaft(V, K, 92, 6, { cover: true });
  b.shaft(R, V, 150, 6);
  b.shaft(V, K, 168, 6, { cover: true });

  b.finish();
  b.setStart('V', 8);
  b.setExit('V', 198);
  b.addAmulet('earth', 'K', 180);
  b.addCheckpoint('V', 46); b.addCheckpoint('V', 128); b.addCheckpoint('V', 184);
  b.addCheckpoint('R', 100); b.addCheckpoint('K', 130);
  b.addSign('V', 12, 'El valle: lobos que aúllan, hadas negras\n(drenan 4 HP/s) y orcos que invocan.\nParry: el tajo contra un mordisco lo anula.');
  b.addSign('V', 96, 'Aldea, tejados y catacumbas.\nDe aquí parte un túnel de techo bajo.');
  b.addSign('K', 172, 'Amuleto de Tierra: cae desde alto\npara provocar una onda al aterrizar.');

  b.populate('V', { table: [['wolf', 4], ['orc', 2]], air: [['blackfairy', 1]], density: 0.09, airDensity: 0.02, from: 20 });
  b.populate('R', { table: [['wolf', 3], ['orc', 1]], air: [['blackfairy', 1]], density: 0.035, airDensity: 0.02 });
  b.populate('K', { table: [['wolf', 3], ['orc', 2]], air: [['blackfairy', 1]], density: 0.04, airDensity: 0.02 });
  b.decorate('V', { table: [['house', 3], ['fence', 2], ['well', 1], ['lamp', 2], ['tombstone', 1], ['tree', 1]], density: 0.28 });
  b.decorate('R', { table: [['lamp', 2], ['bush', 1], ['barrel', 1]], density: 0.12 });
  b.decorate('K', { table: [['tombstone', 3], ['lamp', 1], ['barrel', 1]], density: 0.2 });
  return b.build();
}
