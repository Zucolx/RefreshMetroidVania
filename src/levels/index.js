// Registro de niveles integrados. Cada nivel se construye con LevelBuilder (levels/builder.js).
import { buildLab } from './lab.js';
import { buildForest } from './forest.js';
import { buildVolcano } from './volcano.js';
import { buildValley } from './valley.js';
import { buildCastle } from './castle.js';
import { buildTheater } from './theater.js';

export const LEVELS = [
  { id: 'lab', name: 'Laboratorio', theme: 'lab', blurb: 'Tutorial de mecánicas. Exige salto alto y dash.', amulet: null, build: buildLab },
  { id: 'forest', name: 'Bosque', theme: 'forest', blurb: 'Copas, superficie y cuevas. Arañas, treants y hadas.', amulet: 'water', build: buildForest },
  { id: 'volcano', name: 'Volcán', theme: 'volcano', blurb: 'Galerías, chimenea y pozos de lava. Gólems explosivos.', amulet: 'fire', build: buildVolcano },
  { id: 'valley', name: 'Valle', theme: 'valley', blurb: 'Aldea, tejados, catacumbas y túnel. Lobos, hadas negras y orcos.', amulet: 'earth', build: buildValley },
  { id: 'castle', name: 'Castillo', theme: 'castle', blurb: 'Torres, corredor, salón y cripta. Fantasmas y armaduras.', amulet: 'wind', build: buildCastle },
  { id: 'theater', name: 'Teatro', theme: 'theater', blurb: 'No lineal: vestíbulo, patio, escenario, bastidores, telares y sótano con trampillas.', amulet: 'threads', build: buildTheater },
];
export function buildLevel(id) { const l = LEVELS.find((x) => x.id === id); return l ? l.build() : null; }
