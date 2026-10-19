// Utilidades de prueba: mundos planos y partidas sin navegador.
import { Game } from '../src/game.js';
import { World, T } from '../src/world.js';
import { FakeInput } from '../src/input.js';
import { Store } from '../src/storage.js';
import { CONFIG, resetConfig } from '../src/config.js';

export function flatWorld({ w = 120, h = 40, floor = 30, theme = 'lab' } = {}) {
  const world = new World(w, h, theme, 'test');
  world.fill(0, floor, w, h - floor, T.SOLID);
  world.fill(0, 0, 1, h, T.SOLID); world.fill(w - 1, 0, 1, h, T.SOLID); world.fill(0, 0, w, 1, T.SOLID);
  world.start = { x: 5, y: floor - 1 };
  return world;
}

export function makeGame({ team = ['swordsman'], world = flatWorld(), amulets = [], settle = 30 } = {}) {
  resetConfig();
  Store.data.owned = []; Store.data.equipped = []; Store.data.coins = 0;
  for (const a of amulets) Store.give(a);
  const input = new FakeInput();
  const g = new Game({ input, team });
  g.load(world, { team });
  g.cfgDamageNumbers = false;
  const api = {
    g, input, p: g.player, world,
    run(n = 1) { for (let i = 0; i < n; i++) g.step(); return api; },
    secs(s) { return api.run(Math.round(s * 60)); },
    spawn(type, x, y, extra = {}) { return g.spawnEnemy({ type, x, y, ...extra }); },
  };
  api.run(settle);
  return api;
}
export { CONFIG, T, Store };
