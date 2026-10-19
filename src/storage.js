// Progreso persistente: amuletos, niveles completados, monedas, equipo, controles y ajustes del laboratorio.
import { platform } from './platform.js';
import { CONFIG, configOverrides, applyOverrides } from './config.js';

const KEY = 'mvlab.save.v1';

function blank() {
  return {
    coins: 0,
    completed: [],
    owned: [], // amuletos poseídos
    equipped: [], // amuletos equipados
    team: ['swordsman', 'mage', 'artificer'],
    controls: null,
    lab: {},
    customLevels: {}, // id -> JSON de World
    settings: { touch: 'auto', touchSize: 1, touchOpacity: 0.55, volume: 0.6, vibration: true, quality: 'high' },
  };
}

export const Store = {
  data: blank(),
  load() {
    try {
      const raw = platform.storage.getItem(KEY);
      if (raw) this.data = Object.assign(blank(), JSON.parse(raw));
      this.data.settings = Object.assign(blank().settings, this.data.settings);
    } catch (e) {
      this.data = blank();
    }
    applyOverrides(this.data.lab);
    return this.data;
  },
  save() {
    try {
      this.data.lab = configOverrides();
      platform.storage.setItem(KEY, JSON.stringify(this.data));
    } catch (e) { /* ignora */ }
  },
  resetProgress() {
    const keep = { controls: this.data.controls, lab: this.data.lab, customLevels: this.data.customLevels, settings: this.data.settings, team: this.data.team };
    this.data = Object.assign(blank(), keep);
    this.save();
  },
  has(amulet) { return this.data.owned.includes(amulet); },
  equipped(amulet) { return this.data.equipped.includes(amulet); },
  give(amulet) {
    if (!this.data.owned.includes(amulet)) this.data.owned.push(amulet);
    if (!this.data.equipped.includes(amulet)) this.data.equipped.push(amulet);
    this.save();
  },
  toggleEquip(amulet) {
    if (!this.data.owned.includes(amulet)) return;
    const i = this.data.equipped.indexOf(amulet);
    if (i >= 0) this.data.equipped.splice(i, 1); else this.data.equipped.push(amulet);
    this.save();
  },
  remove(amulet) {
    this.data.owned = this.data.owned.filter((a) => a !== amulet);
    this.data.equipped = this.data.equipped.filter((a) => a !== amulet);
    this.save();
  },
  complete(levelId) {
    if (!this.data.completed.includes(levelId)) this.data.completed.push(levelId);
    this.save();
  },
};

export { CONFIG };
