import type { Game } from "../../core/game";

// Tiny synthesised effects for the town details (bells, quacks, knocks, echoes).
// Rides on the game's AudioContext (created when the visitor enters the town) and
// respects its mute / volume settings.

export class Synth {
  private bus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  constructor(private game: Game) {}

  private ac(): AudioContext | null {
    const a = this.game.audio;
    const ctx = a.ctx;
    if (!ctx || a.muted) return null;
    if (!this.bus || this.bus.context !== ctx) {
      this.bus = ctx.createGain();
      this.bus.connect(a.effectsBus ?? ctx.destination);
      const len = ctx.sampleRate;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    this.bus.gain.value = 1.4;
    return ctx;
  }

  tone(f0: number, f1: number, len: number, vol: number, type: OscillatorType = "sine", delay = 0) {
    const ctx = this.ac();
    if (!ctx || !this.bus) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + len + 0.05);
  }

  noise(freq: number, len: number, vol: number, type: BiquadFilterType = "bandpass", delay = 0, q = 1.2) {
    const ctx = this.ac();
    if (!ctx || !this.bus || !this.noiseBuf) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(g).connect(this.bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + len + 0.05);
  }

  /** Big bronze bell: inharmonic partials with a long decay. */
  bell(base = 196) {
    [1, 2.0, 2.4, 3.0, 4.2, 5.4].forEach((k, i) => this.tone(base * k, base * k * 0.998, 3.2 - i * 0.4, 0.09 / (1 + i * 0.6), "sine"));
    this.noise(2400, 0.08, 0.06, "highpass");
  }

  quack(delay = 0) {
    this.tone(560, 360, 0.13, 0.07, "sawtooth", delay);
    this.noise(1300, 0.12, 0.05, "bandpass", delay, 3);
  }

  knock() {
    for (let i = 0; i < 3; i++) {
      this.noise(220, 0.12, 0.35, "lowpass", i * 0.2);
      this.tone(150, 90, 0.1, 0.08, "sine", i * 0.2);
    }
  }

  /** A call that bounces back fainter and fainter. */
  echo() {
    for (let i = 0; i < 5; i++) {
      const v = 0.07 * Math.pow(0.55, i);
      this.tone(330, 290, 0.32, v, "triangle", i * 0.42);
      this.noise(800, 0.25, v * 0.6, "bandpass", i * 0.42 + 0.02, 2);
    }
  }

  splash(delay = 0) {
    this.noise(900, 0.3, 0.12, "bandpass", delay, 0.8);
    this.tone(500, 900, 0.08, 0.03, "sine", delay);
  }

  rustle() {
    for (let i = 0; i < 4; i++) this.noise(2600 + Math.random() * 1500, 0.22, 0.12, "highpass", i * 0.06);
  }

  whirr(len = 1.0) {
    this.tone(90, 140, len, 0.04, "sawtooth");
    this.noise(400, len, 0.04, "lowpass");
  }

  pop() {
    this.tone(500, 1400, 0.09, 0.08, "sine");
  }

  chime(notes: number[], gap = 0.11, type: OscillatorType = "triangle") {
    notes.forEach((n, i) => {
      const f = 440 * Math.pow(2, (n - 69) / 12);
      this.tone(f, f * 1.001, 0.5, 0.06, type, i * gap);
    });
  }

  crackle(len = 1.2) {
    for (let i = 0; i < 14; i++) this.noise(3000 + Math.random() * 3000, 0.02, 0.05 + Math.random() * 0.05, "highpass", Math.random() * len);
  }

  paper() {
    this.noise(2600, 0.16, 0.08, "bandpass", 0, 0.7);
    this.noise(4200, 0.12, 0.05, "highpass", 0.08);
  }

  crunch() {
    this.noise(1800, 0.06, 0.12, "bandpass", 0, 2);
    this.noise(1200, 0.08, 0.1, "bandpass", 0.07, 2);
  }

  creak() {
    this.tone(160, 110, 0.5, 0.03, "sawtooth");
  }
}
