// Castillo: torres (arriba, torres anchas) · corredor y salón (ruta principal) · cripta. Amuleto de Viento en las torres.
import { LevelBuilder } from './builder.js';

export function buildCastle() {
  const b = new LevelBuilder({ w: 212, h: 60, theme: 'castle', name: 'Castillo', seed: 51 });
  const COR = [['flat', 4], ['up', 1], ['down', 1], ['stairsUp', 1], ['stairsDown', 1], ['pit', 1], ['spikes', 1], ['low', 1], ['arena', 1]];
  const TOR = [['flat', 3], ['platRow', 2], ['pit', 2], ['spikes', 1], ['hops', 1]];
  const CRI = [['flat', 3], ['low', 2], ['pit', 2], ['spikes', 2], ['up', 1], ['down', 1], ['arena', 1]];
  const C = b.band('C', { x0: 4, x1: 208, base: 36, ceil: 12, table: COR, pitHz: 'spike' });
  const T = b.band('T', { x0: 44, x1: 180, base: 18, ceil: 11, table: TOR, pitHz: 'spike', hopHz: 'spike' });
  const K = b.band('K', { x0: 40, x1: 190, base: 54, ceil: 9, table: CRI, pitHz: 'spike' });

  C.flat(20);
  C.slot(62, 10);                              // torre ancha
  C.slot(100, 6);
  C.flat(2).arena(26, 16).flat(2);             // el salón
  C.slot(150, 6); C.slot(168, 6);
  C.fillTo(204).flat(4);
  T.slot(62, 10); T.slot(150, 6);
  T.fillTo(180);
  K.slot(100, 6); K.slot(168, 6);
  K.fillTo(190);

  b.shaft(T, C, 62, 10);
  b.shaft(C, K, 100, 6, { cover: true });
  b.shaft(T, C, 150, 6);
  b.shaft(C, K, 168, 6, { cover: true });

  b.finish();
  b.setStart('C', 8);
  b.setExit('C', 202);
  b.addAmulet('wind', 'T', 172);
  b.addCheckpoint('C', 48); b.addCheckpoint('C', 125); b.addCheckpoint('C', 190);
  b.addCheckpoint('T', 100); b.addCheckpoint('K', 130);
  b.addSign('C', 12, 'El castillo: murciélagos, fantasmas\n(solo magia, explosión y bombas) y armaduras\nque contraatacan. ¡Úsalas con explosiones!');
  b.addSign('C', 56, 'La torre ancha: escalinata diagonal.\nSi fallas, caes al escalón de abajo.');
  b.addSign('T', 164, 'Amuleto de Viento: el sprint\nacumula hasta 3 cargas.');

  b.populate('C', { table: [['armor', 3], ['ghost', 1]], ceil: [['bat', 2]], air: [['ghost', 2]], density: 0.04, ceilDensity: 0.05, airDensity: 0.03, from: 20 });
  b.populate('T', { table: [['armor', 1]], ceil: [['bat', 3]], air: [['ghost', 2]], density: 0.025, ceilDensity: 0.06, airDensity: 0.03 });
  b.populate('K', { table: [['armor', 2]], ceil: [['bat', 2]], air: [['ghost', 2]], density: 0.03, ceilDensity: 0.05, airDensity: 0.04 });
  b.decorate('C', { table: [['pillar', 3], ['banner', 2], ['lamp', 1], ['barrel', 1]], density: 0.25 });
  b.decorate('T', { table: [['banner', 2], ['lamp', 2]], density: 0.15 });
  b.decorate('K', { table: [['tombstone', 3], ['lamp', 1], ['pillar', 1]], density: 0.2 });
  return b.build();
}
