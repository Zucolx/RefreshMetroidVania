// Audio sintetizado con WebAudio (sin archivos). Se desbloquea en el primer gesto del usuario.
import { Store } from './storage.js';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    this.last = {};
    this.muted = false;
  }
  unlock() {
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = Store.data.settings.volume ?? 0.6;
        const comp = this.ctx.createDynamicsCompressor();
        this.master.connect(comp); comp.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { this.enabled = false; }
  }
  setVolume(v) { if (this.master) this.master.gain.value = v; }

  tone(freq, dur, { type = 'square', vol = 0.15, slide = 0, delay = 0, attack = 0.005, vib = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    if (vib) {
      const l = this.ctx.createOscillator(), lg = this.ctx.createGain();
      l.frequency.value = 6; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency);
      l.start(t); l.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, { vol = 0.15, freq = 1500, q = 1, type = 'lowpass', delay = 0, slide = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.02);
  }

  /** Efectos con limitador de repetición para no saturar. */
  sfx(name, opt = {}) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < 0.04) return;
    this.last[name] = now;
    const f = SFX[name];
    if (f) f(this, opt);
  }

  /** Ocarina del espadachín: melodía corta con vibrato suave. */
  ocarina(step = 0) {
    const tune = [69, 72, 76, 74, 72, 69, 67, 69, 72, 71, 67, 64];
    const n = tune[step % tune.length];
    this.tone(NOTE(n), 0.42, { type: 'sine', vol: 0.12, attack: 0.04, vib: 3 });
    this.tone(NOTE(n + 12), 0.4, { type: 'sine', vol: 0.03, attack: 0.05 });
  }
}

const SFX = {
  jump: (a) => a.tone(320, 0.14, { slide: 260, type: 'square', vol: 0.09 }),
  djump: (a) => a.tone(460, 0.16, { slide: 380, type: 'square', vol: 0.09 }),
  land: (a) => a.noise(0.08, { vol: 0.12, freq: 500 }),
  dash: (a) => a.noise(0.18, { vol: 0.14, freq: 2500, slide: -1800, type: 'bandpass' }),
  slash: (a) => a.noise(0.1, { vol: 0.12, freq: 3200, slide: -2200, type: 'bandpass' }),
  hit: (a) => { a.noise(0.09, { vol: 0.18, freq: 1800 }); a.tone(150, 0.08, { type: 'sawtooth', slide: -80, vol: 0.1 }); },
  hurt: (a) => { a.tone(260, 0.25, { type: 'sawtooth', slide: -180, vol: 0.14 }); a.noise(0.15, { vol: 0.12, freq: 800 }); },
  kill: (a) => { a.tone(300, 0.2, { type: 'square', slide: -240, vol: 0.12 }); a.noise(0.2, { vol: 0.12, freq: 1000 }); },
  magic: (a) => { a.tone(700, 0.15, { type: 'triangle', slide: 500, vol: 0.12 }); },
  charged: (a) => { a.tone(300, 0.35, { type: 'sawtooth', slide: 700, vol: 0.12 }); a.tone(900, 0.3, { type: 'triangle', vol: 0.08 }); },
  charge: (a) => a.tone(200, 0.2, { type: 'sine', slide: 300, vol: 0.06 }),
  shield: (a) => { a.tone(520, 0.3, { type: 'sine', slide: 200, vol: 0.12 }); a.tone(780, 0.3, { type: 'sine', vol: 0.06 }); },
  explosion: (a) => { a.noise(0.5, { vol: 0.3, freq: 900, slide: -700 }); a.tone(90, 0.4, { type: 'sawtooth', slide: -50, vol: 0.2 }); },
  boom: (a) => { a.noise(0.35, { vol: 0.22, freq: 1200, slide: -900 }); a.tone(110, 0.3, { type: 'sawtooth', slide: -70, vol: 0.16 }); },
  coin: (a) => { a.tone(988, 0.07, { type: 'square', vol: 0.07 }); a.tone(1319, 0.14, { type: 'square', vol: 0.07, delay: 0.06 }); },
  pickup: (a) => [523, 659, 784, 1046].forEach((f, i) => a.tone(f, 0.18, { type: 'triangle', vol: 0.12, delay: i * 0.08 })),
  parry: (a) => { a.tone(1400, 0.2, { type: 'triangle', vol: 0.15, slide: -300 }); a.noise(0.06, { vol: 0.2, freq: 5000, type: 'highpass' }); },
  bounce: (a) => a.tone(340, 0.14, { type: 'square', slide: 400, vol: 0.09 }),
  swap: (a) => { a.tone(400, 0.1, { type: 'triangle', vol: 0.1 }); a.tone(600, 0.12, { type: 'triangle', vol: 0.1, delay: 0.08 }); },
  entry: (a) => { a.tone(200, 0.4, { type: 'sawtooth', slide: -120, vol: 0.12 }); a.noise(0.3, { vol: 0.2, freq: 700, delay: 0.3 }); },
  heal: (a) => a.tone(660, 0.12, { type: 'sine', slide: 200, vol: 0.05 }),
  meditate: (a) => a.tone(220, 0.8, { type: 'sine', vol: 0.05 }),
  checkpoint: (a) => [392, 523, 659].forEach((f, i) => a.tone(f, 0.2, { type: 'triangle', vol: 0.12, delay: i * 0.1 })),
  exit: (a) => [523, 659, 784, 1046, 1318].forEach((f, i) => a.tone(f, 0.25, { type: 'triangle', vol: 0.12, delay: i * 0.09 })),
  menu: (a) => a.tone(520, 0.05, { type: 'square', vol: 0.05 }),
  ok: (a) => a.tone(780, 0.09, { type: 'square', vol: 0.06 }),
  fire: (a) => a.noise(0.25, { vol: 0.14, freq: 1200, slide: -500, type: 'bandpass' }),
  screech: (a) => { a.tone(1800, 0.3, { type: 'sawtooth', slide: -900, vol: 0.1 }); },
  howl: (a) => { a.tone(300, 0.7, { type: 'sine', slide: 300, vol: 0.12, vib: 10 }); },
  ja: (a) => { a.tone(500, 0.08, { type: 'square', vol: 0.07 }); a.tone(420, 0.1, { type: 'square', vol: 0.07, delay: 0.1 }); },
  whoosh: (a) => a.noise(0.25, { vol: 0.1, freq: 1800, slide: -1200, type: 'bandpass' }),
  tick: (a) => a.tone(1800, 0.03, { type: 'square', vol: 0.05 }),
  rewind: (a) => a.tone(900, 0.4, { type: 'sawtooth', slide: -700, vol: 0.1 }),
  hook: (a) => { a.tone(900, 0.07, { type: 'square', vol: 0.08 }); a.noise(0.05, { vol: 0.1, freq: 4000, type: 'highpass' }); },
  glass: (a) => { a.tone(2200, 0.1, { type: 'triangle', vol: 0.08 }); a.noise(0.12, { vol: 0.1, freq: 5000, type: 'highpass' }); },
  sharpen: (a) => a.noise(0.35, { vol: 0.06, freq: 4500, type: 'highpass', slide: 1000 }),
  shake: (a) => a.noise(0.1, { vol: 0.07, freq: 3000, type: 'highpass' }),
  page: (a) => a.noise(0.08, { vol: 0.05, freq: 2500, type: 'bandpass' }),
  crank: (a) => { a.tone(1200, 0.03, { type: 'square', vol: 0.05 }); },
};

export const audio = new AudioSys();
export { SFX, NOTE };
