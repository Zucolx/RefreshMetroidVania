// Teatro (no lineal): vestíbulo → patio → escenario → bastidores → telares → trampillas.
// Sótano bajo las trampillas con pasadizo secreto al amuleto de los Hilos; noria opcional a un palco.
import { LevelBuilder } from './builder.js';
import { T } from '../world.js';

export function buildTheater() {
  const b = new LevelBuilder({ w: 220, h: 60, theme: 'theater', name: 'Teatro', seed: 61 });
  const MAIN = [['flat', 4], ['up', 1], ['down', 1], ['pit', 1], ['arena', 1], ['low', 1], ['stairsUp', 1], ['stairsDown', 1]];
  const TEL = [['flat', 3], ['platRow', 3], ['pit', 2], ['spikes', 1]];
  const SOT = [['flat', 3], ['low', 2], ['pit', 2], ['spikes', 1], ['up', 1], ['down', 1], ['arena', 1]];
  const M = b.band('M', { x0: 4, x1: 216, base: 36, ceil: 11, table: MAIN, pitHz: 'spike' });
  const Tl = b.band('T', { x0: 124, x1: 202, base: 18, ceil: 11, table: TEL, pitHz: 'spike', hopHz: 'spike' });
  const S = b.band('S', { x0: 18, x1: 216, base: 54, ceil: 9, table: SOT, pitHz: 'spike' });
  const X = b.band('X', { x0: 4, x1: 18, base: 54, ceil: 4 });   // cámara secreta

  // ---- tramo principal ----
  M.flat(18);                                  // vestíbulo
  M.slot(30, 6);                               // escalera al sótano
  M.slot(70, 4);                               // trampillas del patio
  M.fillTo(86);
  M.flat(2).arena(18, 16);                     // escenario (techo alto)
  M.slot(110, 4);                              // trampillas del escenario
  M.slot(138, 6);                              // escalera a los telares
  M.fillTo(160);
  M.slot(168, 6);                              // bajada de los telares / escalera al sótano
  M.slot(188, 6);                              // escalera al sótano
  M.slot(204, 4);                              // trampillas finales
  M.fillTo(212).flat(4);

  // ---- telares (arriba) ----
  Tl.slot(138, 6); Tl.slot(168, 6);
  Tl.fillTo(202);

  // ---- sótano ----
  S.flat(5, 'lowceil', 3);                     // paso bajo hacia la cámara secreta
  S.slot(30, 6); S.slot(70, 4); S.slot(110, 4); S.slot(188, 6); S.slot(204, 4);
  S.fillTo(216);
  X.flat(14);

  b.shaft(M, S, 30, 6, { cover: true });
  b.trapShaft(M, S, 70, 4, 2, { phase: 0 });
  b.trapShaft(M, S, 110, 4, 2, { phase: 1 });
  b.shaft(Tl, M, 138, 6);
  b.shaft(Tl, M, 168, 6);
  b.shaft(M, S, 188, 6, { cover: true });
  b.trapShaft(M, S, 204, 4, 2, { phase: 2 });

  // ---- palco (opcional, solo por la noria) ----
  b.extra.push((world) => {
    world.fill(122, 28, 14, 2, T.SOLID);
  });

  b.finish();
  b.setStart('M', 8);
  b.setExit('M', 213);
  b.addAmulet('threads', 'X', 8);
  b.addCheckpoint('M', 54); b.addCheckpoint('M', 96); b.addCheckpoint('M', 152); b.addCheckpoint('M', 178);
  b.addCheckpoint('T', 150); b.addCheckpoint('S', 130); b.addCheckpoint('S', 170);
  b.addSign('M', 12, 'El teatro: marionetas, actores sombra que\nte imitan, máscaras que se ríen y payasos.\nLas trampillas se abren: ¡no te caigas!');
  b.addSign('M', 80, 'Escenario: focos que caen, cortinas y una noria.\nSube a la noria para llegar al palco.');
  b.addSign('S', 24, 'Tras el paso bajo hay una cámara secreta.\nAmuleto de los Hilos: golpes consecutivos +40 %.');
  b.addSign('T', 130, 'Los telares: cuerdas que enredan.\nUn dash con i-frames las cruza.');
  // el palco: cartel directamente (no es una banda)
  b.world.signs.push({ x: 128, y: 27, text: '¡Palco! Buenas vistas desde aquí.' });

  // ---- pasada 2: peligros del teatro ----
  const top = (band, x) => band.top[x];
  const tryIt = (fn) => { try { fn(); } catch (e) { /* sin hueco: se omite */ } };
  const curtain = (bandId, x) => tryIt(() => { const bnd = b.bands.get(bandId); const sx = b.spot(bandId, x); b.props.push({ type: 'curtain', x: sx, y: top(bnd, sx), h: bnd.fl[sx] - top(bnd, sx), phase: b.props.length }); b.reserved.push([sx - 1, sx + 1]); });
  curtain('M', 20); curtain('M', 44); curtain('M', 64); curtain('M', 152);
  const spot = (bandId, x) => tryIt(() => { const bnd = b.bands.get(bandId); const sx = b.spot(bandId, x, { margin: 1 }); b.props.push({ type: 'spotlight', x: sx, y: top(bnd, sx) }); });
  [92, 100, 118].forEach((x) => spot('M', x));
  spot('M', 160); spot('T', 150); spot('T', 176);
  const rope = (bandId, x, len) => tryIt(() => { const bnd = b.bands.get(bandId); const sx = b.spot(bandId, x, { margin: 1 }); b.props.push({ type: 'rope', x: sx, y: top(bnd, sx), len: len || bnd.fl[sx] - top(bnd, sx) - 1 }); });
  rope('M', 36); rope('M', 142); rope('M', 196); rope('T', 128); rope('T', 160);
  b.props.push({ type: 'ferris', x: 106, y: 30, r: 150 });

  b.populate('M', { table: [['marionette', 3], ['shadow', 2], ['clown', 2]], air: [['mask', 2]], density: 0.16, airDensity: 0.04, from: 20 });
  b.populate('T', { table: [['marionette', 2], ['clown', 1]], air: [['mask', 2]], density: 0.12, airDensity: 0.05 });
  b.populate('S', { table: [['marionette', 2], ['shadow', 2], ['clown', 2]], air: [['mask', 1]], density: 0.12, airDensity: 0.03 });
  [48, 92, 118, 150, 196].forEach((x) => b.spawns.push({ type: 'mask', x, y: 27 }));
  b.decorate('M', { table: [['chair', 4], ['pillar', 2], ['banner', 2], ['lamp', 1], ['barrel', 1]], density: 0.25 });
  b.decorate('T', { table: [['banner', 2], ['lamp', 2]], density: 0.15 });
  b.decorate('S', { table: [['barrel', 3], ['tombstone', 1], ['lamp', 1]], density: 0.2 });
  return b.build();
}
