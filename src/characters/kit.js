// Clase base de los personajes ("kits"). Un kit define: combo, ataque cargado, aéreo abajo, Especial,
// entrada heroica, dos idles (base + sabor) y su aspecto (paleta, sombrero, arma).
// Para añadir un personaje: extender Kit, registrarlo en characters/index.js y poner su vida en CONFIG.characters.
import { CONFIG } from '../config.js';
import { audio } from '../audio.js';

export class Kit {
  constructor(id, meta) {
    this.id = id;
    this.name = meta.name;
    this.desc = meta.desc || '';
    this.pal = meta.pal;
    this.cd = {}; // enfriamientos (siguen corriendo en la reserva)
    this.combo = 0;
    this.comboT = 0;
    this.swingTimes = [0.22, 0.22, 0.3];
    this.window = CONFIG.sword.window;
    this.chargeTime = 0.9; // tiempo total de pulsación que dispara el ataque cargado
    this.chargeSlow = 1; // multiplicador de velocidad mientras se carga
    this.flavorKinds = ['default'];
    this.flavorDur = 4.5;
    this.special = { name: 'Especial' };
  }
  get maxHp() { return CONFIG.characters[this.id].hp; }

  // ---------- ciclo ----------
  /** Se llama cada paso para todos los miembros del equipo (activo o reserva). */
  tick(p, g, dt, active) {
    for (const k in this.cd) if (this.cd[k] > 0) this.cd[k] = Math.max(0, this.cd[k] - dt);
    if (this.comboT > 0) this.comboT -= dt;
    this.update && this.update(p, g, dt, active);
  }
  /** Cancela cargas y acciones en curso (dash, daño, cambio). */
  cancel(p, g) {}
  onSwitchIn(p, g) {}
  onSwitchOut(p, g) {}
  onHurt(p, g, amount, src) {}

  // ---------- ataque ----------
  attackPress(p, g) { return this.comboStep(p, g); }
  comboStep(p, g) {
    if (p.atkLock > 0) { p.atkBuf = 0.15; return false; }
    if (this.comboT <= 0) this.combo = 0;
    const i = this.combo;
    const webMul = p.webbed > 0 ? 1.7 : 1;
    const st = this.swingTimes[i] * webMul;
    this.combo = (i + 1) % 3;
    this.comboT = st + this.window;
    p.atkLock = st;
    p.actionT = 0;
    p.lastAct = { type: 'attack', time: p.g.time };
    if (p.webbed > 0) p.untangle(0.4);
    this.swing(p, g, i, st);
    return true;
  }
  swing() {}
  /** Se dispara una vez cuando la pulsación alcanza chargeTime. */
  chargeFire() {}
  /** Mientras se mantiene (para visuales/apuntado). */
  chargeUpdate() {}
  attackRelease() {}
  /** ↓ + atacar en el aire. Devuelve true si se usó. */
  airDown() { return false; }

  // ---------- especial ----------
  specialPress() {}
  specialHold() {}
  specialRelease() {}
  specialInfo() { return { name: this.special.name, frac: 1, state: 'listo' }; }

  // ---------- modificadores ----------
  speedMul() { return 1; }
  /** Devuelve el tipo de carrera a velocidad máxima ('skate', 'rocket', 'trail'…) o null. */
  maxDash() { return 'trail'; }
  damageTakenMul() { return 1; }
  /** Permite bloquear un golpe antes de calcular daño. Devuelve 'blocked' o null. */
  blockHit() { return null; }
  /** ¿El kit impide atacar con arma (escudo levantado, etc.)? */
  blocksAttack() { return false; }
  /** Colocación del arma/estados que impiden fijar la dirección. */
  lockFacing() { return false; }

  // ---------- entrada heroica ----------
  entry(p, g) {}

  // ---------- idles ----------
  pickFlavor() { return this.flavorKinds[Math.floor(Math.random() * this.flavorKinds.length)]; }
  idleBase(p, t, pose) {
    pose.bob += Math.sin(t * 2.2) * 0.9;
    pose.arm += Math.sin(t * 2.2 + 1) * 0.06;
    pose.armB += Math.sin(t * 2.2) * 0.05;
    pose.lean += Math.sin(t * 1.1) * 0.02;
  }
  idleFlavor() {}
  drawFlavor() {}

  // ---------- dibujo ----------
  drawWeapon() {}
  drawBack() {}
  drawFront() {}

  // ---------- utilidades ----------
  sfx(n, o) { audio.sfx(n, o); }
}
