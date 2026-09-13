/** Tiny chiptune-ish SFX synth (no assets needed). */
class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  private ac(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  resume() {
    this.ac();
  }

  tone(freq: number, dur: number, type: OscillatorType = "square", vol = 0.06, slide = 0) {
    const ctx = this.ac();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur: number, vol = 0.06, hp = 600) {
    const ctx = this.ac();
    if (!ctx) return;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start();
  }

  chop() {
    this.noise(0.12, 0.08, 400);
    this.tone(160, 0.08, "square", 0.03, -60);
  }
  mine() {
    this.noise(0.1, 0.07, 1400);
    this.tone(300, 0.06, "square", 0.03, -120);
  }
  swing() {
    this.noise(0.08, 0.03, 2200);
  }
  hit() {
    this.tone(420, 0.09, "square", 0.05, -200);
    this.noise(0.07, 0.05, 900);
  }
  hurt() {
    this.tone(220, 0.22, "sawtooth", 0.07, -120);
  }
  pickup() {
    this.tone(680, 0.06, "square", 0.035);
    window.setTimeout(() => this.tone(920, 0.07, "square", 0.03), 55);
  }
  craft() {
    this.tone(520, 0.08, "triangle", 0.05);
    window.setTimeout(() => this.tone(700, 0.08, "triangle", 0.05), 80);
    window.setTimeout(() => this.tone(880, 0.12, "triangle", 0.05), 165);
  }
  eat() {
    this.tone(300, 0.07, "triangle", 0.05, 120);
  }
  place() {
    this.tone(180, 0.1, "square", 0.05, 60);
  }
  die() {
    this.tone(330, 0.5, "sawtooth", 0.08, -260);
  }
  night() {
    this.tone(140, 0.8, "sine", 0.07, -60);
  }
  dawn() {
    this.tone(440, 0.3, "sine", 0.05, 220);
  }
  levelup() {
    [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => this.tone(f, 0.13, "square", 0.045), i * 90));
  }
}

export const sfx = new Sfx();
