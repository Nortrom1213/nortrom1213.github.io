// All sound is synthesised with Web Audio: a gentle generative music bed, ambience
// that follows time of day and weather, and short UI / footstep effects.

type Mood = "day" | "night" | "interior" | "tense" | "silent";

const PENTA = [0, 2, 4, 7, 9];

export class AudioSystem {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private ambBus!: GainNode;
  private sfxBus!: GainNode;
  private rainGain!: GainNode;
  private windGain!: GainNode;
  private nextNoteTime = 0;
  private step = 0;
  private mood: Mood = "day";
  private timer: number | null = null;
  private noiseBuf!: AudioBuffer;
  muted = false;
  volume = 0.7;
  private nightAmount = 0;
  private birdTimer = 0;
  private cricketTimer = 0;

  /** Must be called from a user gesture. */
  start() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    this.master.connect(comp).connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.32;
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.musicBus.connect(this.master);
    this.musicBus.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(this.master);

    this.ambBus = ctx.createGain();
    this.ambBus.gain.value = 0.5;
    this.ambBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.6;
    this.sfxBus.connect(this.master);

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Looping rain and wind beds, faded in by setWeather().
    this.rainGain = this.loopNoise(2600, 0.6, "highpass");
    this.windGain = this.loopNoise(420, 1.2, "lowpass");

    this.nextNoteTime = ctx.currentTime + 0.3;
    this.timer = window.setInterval(() => this.schedule(), 90);
  }

  private loopNoise(freq: number, q: number, type: BiquadFilterType): GainNode {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.ambBus);
    src.start();
    return g;
  }

  /** Effects bus for add-on sounds (respects mute, volume and the compressor). */
  get effectsBus(): AudioNode | null {
    return this.ctx ? this.sfxBus : null;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.1);
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx && !this.muted) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  setMood(m: Mood) {
    this.mood = m;
  }

  setWeather(rain: number, wind: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.rainGain.gain.setTargetAtTime(rain * 0.22, t, 1.2);
    this.windGain.gain.setTargetAtTime(wind * 0.12, t, 1.5);
  }

  /** Called every frame with the outdoor night factor (0 day .. 1 night). */
  tickAmbience(dt: number, night: number, outdoors: boolean) {
    if (!this.ctx || this.muted) return;
    this.nightAmount = night;
    if (!outdoors) return;
    this.birdTimer -= dt;
    this.cricketTimer -= dt;
    if (night < 0.4 && this.birdTimer <= 0) {
      this.birdTimer = 2 + Math.random() * 5;
      this.chirp();
    }
    if (night > 0.6 && this.cricketTimer <= 0) {
      this.cricketTimer = 0.6 + Math.random() * 1.4;
      this.cricket();
    }
  }

  private schedule() {
    const ctx = this.ctx!;
    if (this.mood === "silent") {
      this.nextNoteTime = ctx.currentTime + 0.2;
      return;
    }
    const bpm = this.mood === "tense" ? 96 : this.mood === "night" ? 64 : 76;
    const stepDur = 60 / bpm / 2;
    while (this.nextNoteTime < ctx.currentTime + 0.3) {
      this.playStep(this.step, this.nextNoteTime, stepDur);
      this.nextNoteTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(step: number, t: number, dur: number) {
    const tense = this.mood === "tense";
    // I - vi - IV - V in C, gentle; tense mode sits on a minor drone.
    const chords = tense ? [[57, 60, 64], [57, 60, 63], [55, 58, 62], [56, 60, 63]] : [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
    const bar = Math.floor(step / 16);
    const chord = chords[bar % 4];
    if (step % 16 === 0) {
      for (const n of chord) this.pad(n - 12, t, dur * 16, tense ? 0.05 : 0.045);
      this.pluck(chord[0] - 24, t, 0.09, 1.8);
    }
    if (step % 8 === 4) this.pluck(chord[0] - 24 + 7, t, 0.05, 1.2);
    // Sparse pentatonic melody, more sparse at night.
    const density = this.mood === "night" ? 0.22 : this.mood === "interior" ? 0.3 : 0.38;
    const seed = Math.sin(step * 12.9898 + bar * 78.233) * 43758.5453;
    const r = seed - Math.floor(seed);
    if (step % 2 === 0 && r < density) {
      const deg = PENTA[Math.floor(r * 97) % PENTA.length];
      const oct = r < density * 0.4 ? 12 : 0;
      this.pluck(60 + deg + oct + (tense ? -3 : 0), t, this.mood === "night" ? 0.05 : 0.07, 1.4, this.mood === "night" ? "sine" : "triangle");
    }
    if (tense && step % 4 === 0) this.tick(t, step % 16 === 0 ? 0.07 : 0.03);
  }

  private freq(midi: number) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  private pluck(midi: number, t: number, vol: number, decay: number, type: OscillatorType = "triangle") {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = this.freq(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + decay + 0.05);
  }

  private pad(midi: number, t: number, len: number, vol: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = this.freq(midi);
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = this.freq(midi) * 1.003;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + len * 0.3);
    g.gain.linearRampToValueAtTime(0, t + len);
    o.connect(g);
    o2.connect(g);
    g.connect(this.musicBus);
    o.start(t);
    o2.start(t);
    o.stop(t + len + 0.1);
    o2.stop(t + len + 0.1);
  }

  private tick(t: number, vol: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 5000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f).connect(g).connect(this.musicBus);
    src.start(t, Math.random());
    src.stop(t + 0.06);
  }

  private chirp() {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const n = 2 + Math.floor(Math.random() * 3);
    const base = 2600 + Math.random() * 1600;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator();
      o.type = "sine";
      const s = t + i * 0.11;
      o.frequency.setValueAtTime(base, s);
      o.frequency.exponentialRampToValueAtTime(base * 1.35, s + 0.06);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.025 * (1 - this.nightAmount), s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.08);
      o.connect(g).connect(this.ambBus);
      o.start(s);
      o.stop(s + 0.1);
    }
  }

  private cricket() {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = 4200 + Math.random() * 300;
      const g = ctx.createGain();
      const s = t + i * 0.05;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.008 * this.nightAmount, s + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.035);
      o.connect(g).connect(this.ambBus);
      o.start(s);
      o.stop(s + 0.04);
    }
  }

  // ---- Effects --------------------------------------------------------------

  sfx(name: "step" | "jump" | "land" | "interact" | "open" | "close" | "door" | "success" | "fail" | "alert" | "coin" | "click" | "purr", vol = 1) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    const tone = (f0: number, f1: number, len: number, v: number, type: OscillatorType = "sine", delay = 0) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t + delay);
      o.frequency.exponentialRampToValueAtTime(f1, t + delay + len);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + delay);
      g.gain.linearRampToValueAtTime(v * vol, t + delay + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + len);
      o.connect(g).connect(this.sfxBus);
      o.start(t + delay);
      o.stop(t + delay + len + 0.02);
    };
    const noise = (freq: number, len: number, v: number, type: BiquadFilterType = "bandpass") => {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(v * vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      src.connect(f).connect(g).connect(this.sfxBus);
      src.start(t, Math.random() * 1.5);
      src.stop(t + len + 0.02);
    };
    switch (name) {
      case "step":
        noise(600 + Math.random() * 300, 0.07, 0.12);
        break;
      case "jump":
        tone(320, 640, 0.14, 0.08, "triangle");
        break;
      case "land":
        noise(260, 0.12, 0.2, "lowpass");
        break;
      case "interact":
        tone(880, 1320, 0.12, 0.08, "triangle");
        tone(1320, 1760, 0.14, 0.05, "sine", 0.06);
        break;
      case "open":
        tone(523, 784, 0.18, 0.07, "triangle");
        break;
      case "close":
        tone(784, 523, 0.16, 0.06, "triangle");
        break;
      case "door":
        noise(180, 0.35, 0.25, "lowpass");
        tone(140, 90, 0.3, 0.06, "sine");
        break;
      case "success":
        [0, 4, 7, 12].forEach((n, i) => tone(this.freq(72 + n), this.freq(72 + n) * 1.001, 0.4, 0.08, "triangle", i * 0.09));
        break;
      case "fail":
        tone(330, 160, 0.5, 0.1, "sawtooth");
        break;
      case "alert":
        tone(880, 880, 0.12, 0.1, "square");
        tone(1175, 1175, 0.16, 0.1, "square", 0.13);
        break;
      case "coin":
        tone(1320, 1320, 0.06, 0.07, "square");
        tone(1760, 1760, 0.18, 0.06, "square", 0.06);
        break;
      case "click":
        tone(1200, 900, 0.04, 0.05, "triangle");
        break;
      case "purr":
        for (let i = 0; i < 6; i++) noise(90, 0.12, 0.25, "lowpass");
        tone(60, 55, 0.8, 0.05, "sawtooth");
        break;
    }
  }

  dispose() {
    if (this.timer) clearInterval(this.timer);
    void this.ctx?.close();
  }
}
