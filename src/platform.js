// Platform adapter: aísla ciclo de vida, pantalla completa/orientación, gamepad/touch,
// almacenamiento y desbloqueo de audio. La misma src/ corre en Web, Android (Capacitor) y Steam (Electron/Tauri).

const hasWindow = typeof window !== 'undefined';

function detectTarget() {
  if (!hasWindow) return 'node';
  if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) return 'android';
  if (window.electronAPI || window.__TAURI__ || /Electron\//.test(navigator.userAgent)) return 'steam';
  const q = new URLSearchParams(location.search).get('platform');
  if (q === 'android' || q === 'steam') return q;
  return 'web';
}

/** Almacenamiento síncrono con tres capas: archivo nativo (Steam) → localStorage → memoria. */
function makeStorage(target) {
  const mem = new Map();
  const native = hasWindow && window.electronAPI && window.electronAPI.storage;
  return {
    kind: native ? 'file' : 'localStorage',
    getItem(k) {
      try {
        if (native) return native.get(k);
        if (hasWindow) return window.localStorage.getItem(k);
      } catch (e) { /* cae a memoria */ }
      return mem.has(k) ? mem.get(k) : null;
    },
    setItem(k, v) {
      mem.set(k, v);
      try {
        if (native) native.set(k, v);
        else if (hasWindow) window.localStorage.setItem(k, v);
      } catch (e) { /* cuota o modo privado */ }
    },
    removeItem(k) {
      mem.delete(k);
      try {
        if (native) native.remove(k);
        else if (hasWindow) window.localStorage.removeItem(k);
      } catch (e) { /* nada */ }
    },
  };
}

class Platform {
  constructor() {
    this.target = detectTarget();
    this.storage = makeStorage(this.target);
    this.hasTouch = hasWindow && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
    this.coarse = hasWindow && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    this._gesture = [];
    this._gestured = false;
    if (hasWindow) {
      const fire = () => {
        if (this._gestured) return;
        this._gestured = true;
        for (const cb of this._gesture) { try { cb(); } catch (e) { /* ignora */ } }
        this._gesture.length = 0;
      };
      for (const ev of ['pointerdown', 'keydown', 'touchstart', 'gamepadconnected']) {
        window.addEventListener(ev, fire, { once: false, passive: true });
      }
      // Los mandos solo aparecen en getGamepads() tras pulsar un botón; lo tratamos como gesto.
    }
  }
  get isNative() { return this.target === 'android' || this.target === 'steam'; }
  get label() { return { web: 'Web', android: 'Android', steam: 'Steam', node: 'Node' }[this.target]; }

  /** Ejecuta cb en el primer gesto del usuario (desbloqueo de audio). */
  onFirstGesture(cb) {
    if (this._gestured) cb();
    else this._gesture.push(cb);
  }

  get fullscreenActive() {
    return hasWindow && !!(document.fullscreenElement || document.webkitFullscreenElement);
  }
  async enterFullscreen(el) {
    if (!hasWindow) return;
    el = el || document.documentElement;
    try {
      if (this.target === 'steam' && window.electronAPI && window.electronAPI.setFullscreen) window.electronAPI.setFullscreen(true);
      else if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch (e) { /* denegado */ }
    await this.lockLandscape();
  }
  async exitFullscreen() {
    if (!hasWindow) return;
    try {
      if (this.target === 'steam' && window.electronAPI && window.electronAPI.setFullscreen) window.electronAPI.setFullscreen(false);
      else if (document.exitFullscreen) await document.exitFullscreen();
    } catch (e) { /* nada */ }
    this.unlockOrientation();
  }
  toggleFullscreen(el) {
    return this.fullscreenActive ? this.exitFullscreen() : this.enterFullscreen(el);
  }
  async lockLandscape() {
    try {
      const so = hasWindow && screen.orientation;
      if (so && so.lock) await so.lock('landscape');
    } catch (e) { /* iOS / escritorio: no soportado */ }
  }
  unlockOrientation() {
    try { if (hasWindow && screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* nada */ }
  }
  /** Modo inmersivo en Android (Capacitor): se aplica si hay plugin; si no, pantalla completa web. */
  setupNative() {
    if (!hasWindow) return;
    const cap = window.Capacitor;
    if (this.target === 'android' && cap && cap.Plugins) {
      const { StatusBar, ScreenOrientation, SplashScreen } = cap.Plugins;
      try { StatusBar && StatusBar.hide && StatusBar.hide(); } catch (e) { /* nada */ }
      try { ScreenOrientation && ScreenOrientation.lock && ScreenOrientation.lock({ orientation: 'landscape' }); } catch (e) { /* nada */ }
      try { SplashScreen && SplashScreen.hide && SplashScreen.hide(); } catch (e) { /* nada */ }
    }
    if (this.target !== 'web') document.documentElement.classList.add('native');
  }
  /** Ciclo de vida: pausar al ocultarse la app (Android) o perder foco. */
  onLifecycle(cb) {
    if (!hasWindow) return;
    document.addEventListener('visibilitychange', () => cb(document.hidden ? 'hidden' : 'visible'));
    window.addEventListener('blur', () => cb('blur'));
    const cap = window.Capacitor;
    if (cap && cap.Plugins && cap.Plugins.App && cap.Plugins.App.addListener) {
      cap.Plugins.App.addListener('appStateChange', (s) => cb(s.isActive ? 'visible' : 'hidden'));
    }
  }
  getGamepads() {
    if (!hasWindow || !navigator.getGamepads) return [];
    try { return Array.from(navigator.getGamepads()).filter(Boolean); } catch (e) { return []; }
  }
  vibrate(pad, ms = 80, strong = 0.6, weak = 0.4) {
    try {
      if (pad && pad.vibrationActuator && pad.vibrationActuator.playEffect) {
        pad.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak });
      } else if (this.target === 'android' && navigator.vibrate) navigator.vibrate(ms);
    } catch (e) { /* nada */ }
  }
  quit() {
    if (this.target === 'steam' && window.electronAPI && window.electronAPI.quit) window.electronAPI.quit();
    else if (this.target === 'android' && window.Capacitor && window.Capacitor.Plugins.App) window.Capacitor.Plugins.App.exitApp();
  }
}

export const platform = new Platform();
export { Platform };
