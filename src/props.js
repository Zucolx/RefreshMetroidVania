// Elementos dinámicos del nivel (trampillas, cortinas, focos, cuerdas, noria…). Se amplía en props/theater.js.
import { createTheaterProp } from './props/theater.js';

export function createProp(g, spec) {
  return createTheaterProp(g, spec);
}
