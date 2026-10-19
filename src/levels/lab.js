// Laboratorio: tutorial de mecánicas. Exige salto alto (muro de 10 tiles) y dash (foso de 13 tiles).
import { LevelBuilder } from './builder.js';

export function buildLab() {
  const b = new LevelBuilder({ w: 210, h: 60, theme: 'lab', name: 'Laboratorio', seed: 11 });
  b.abilities = ['jump', 'double', 'dash', 'high'];
  const M1 = b.band('M1', { x0: 4, x1: 94, base: 36, ceil: 10 });
  const H = b.band('H', { x0: 94, x1: 120, base: 23, ceil: 10 });
  const M2 = b.band('M2', { x0: 106, x1: 206, base: 36, ceil: 10 });
  const D = b.band('D', { x0: 26, x1: 110, base: 54, ceil: 9 });
  const U = b.band('U', { x0: 130, x1: 192, base: 18, ceil: 10 });

  // ---- M1: aula de movimiento y combate ----
  M1.flat(16);                                   // 4..19 sala de inicio
  M1.flat(3).shift(1).flat(5).shift(2).flat(6);  // 20..33 escalones de práctica
  M1.flat(14);                                   // 34..47 sala del pozo (suelo llano)
  M1.flat(3).spikes(3).flat(4);                  // 48..57 pinchos
  M1.flat(3).pit(3, 'lava').flat(3);             // 58..66 foso de lava
  M1.arena(14);                                  // 67..80 sala de combate
  M1.flat(14, 'arena', 16);                      // 81..94 antesala del muro (techo alto)
  // ---- H: plataforma alta (muro de 10 tiles: exige salto alto) ----
  H.flat(26);
  // ---- M2 ----
  M2.flat(14);                                   // 106..119 túnel bajo la plataforma alta
  M2.flat(10, 'arena', 14);                      // 120..129 caída desde la plataforma alta
  M2.flat(10);
  M2.pit(13, 'lava', 6);                         // foso de 13 tiles: exige dash
  M2.flat(14);                                   // zona de tiradores
  M2.arena(16);
  M2.flat(14);
  M2.flat(6);
  M2.flat(10);
  M2.fillTo(206, [['flat', 1]]);
  // ---- D: sótano de pruebas ----
  D.flat(20);
  D.flat(4).spikes(2).flat(4);
  D.arena(16);
  D.flat(12);
  D.fillTo(110, [['flat', 1]]);
  // ---- U: azotea de práctica ----
  U.flat(34);
  U.platRow(14);
  U.fillTo(192, [['flat', 1]]);

  b.shaft(M1, D, 36, 6);
  b.shaft(H, M2, 110, 6);
  b.shaft(U, M2, 156, 6);

  b.startPos = { band: 'M1', x: 8 };
  b.exitPos = { band: 'M2', x: 200 };

  b.sign(9, 'M1', 'Bienvenido al laboratorio.\nMover: ← → / A D\nSaltar: {jump} (más tiempo = más alto)');
  b.sign(24, 'M1', 'Doble salto: {jump} otra vez en el aire.\nSalto alto: ↑ + mantener {jump} 1 s (2 s = onda)');
  b.sign(39, 'M1', 'Pozo: baja por aquí. ↓ + {jump} atraviesa\nlas plataformas finas.');
  b.sign(47, 'M1', 'Pinchos (15) y lava (25) te devuelven\nal último suelo seguro.');
  b.sign(70, 'M1', 'Combate: {attack} ataca (combo ×3)\n{magic} magia · ↓+{magic} escudo · ↑+{magic} explosión');
  b.sign(86, 'M1', 'Este muro mide 10 tiles:\nusa el SALTO ALTO (↑ + mantener {jump}).');
  b.sign(124, 'M2', 'Dash: {dash}. Tras un dash, mantén la\ndirección para correr (sprint).');
  b.sign(136, 'M2', '13 tiles de lava: encadena\nsalto + dash para cruzar.');
  b.checkpoint(18, 'M1');
  b.checkpoint(86, 'M1');
  b.checkpoint(100, 'H');
  b.checkpoint(165, 'M2');
  b.checkpoint(60, 'D');

  b.finish();
  b.populate('M1', { table: [['patrol', 3], ['chaser', 1]], density: 0.06, from: 30 });
  b.populate('M2', { table: [['patrol', 2], ['chaser', 2], ['shooter', 3]], density: 0.07, from: 150 });
  b.populate('D', { table: [['patrol', 2], ['chaser', 2], ['shooter', 2]], density: 0.09 });
  b.populate('U', { table: [['shooter', 2], ['patrol', 1]], density: 0.06 });
  b.decorate('M1', { table: [['barrel', 2], ['crystal', 1], ['lamp', 2]], density: 0.1 });
  b.decorate('M2', { table: [['barrel', 2], ['crystal', 1], ['lamp', 2]], density: 0.1 });
  b.decorate('D', { table: [['crystal', 2], ['lamp', 1]], density: 0.1 });
  return b.build();
}
