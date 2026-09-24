import { audio, noise } from './audioEngine';

/**
 * Qisqa ovoz effektlari — har biri oscillator/shovqin + gain konverti.
 * `at` — AudioContext vaqtiga nisbatan kechikish (s), countdown kabi aniq rejalashtirish uchun.
 */

type Wave = OscillatorType;

function tone(freq: number, dur: number, opts: { type?: Wave; volume?: number; at?: number; slideTo?: number } = {}) {
  const a = audio();
  if (!a) return;
  const { ctx, out } = a;
  const t = ctx.currentTime + (opts.at ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t + dur);
  const v = opts.volume ?? 0.25;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noiseBurst(dur: number, opts: { freq: number; q?: number; volume?: number; type?: BiquadFilterType; sweepTo?: number }) {
  const a = audio();
  if (!a) return;
  const { ctx, out } = a;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = opts.type ?? 'bandpass';
  filter.frequency.setValueAtTime(opts.freq, t);
  if (opts.sweepTo) filter.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + dur);
  filter.Q.value = opts.q ?? 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(opts.volume ?? 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(out);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

export const sfx = {
  /** Tanga: ikki yuqori "ding" */
  coin() {
    tone(988, 0.08, { type: 'square', volume: 0.12 });
    tone(1319, 0.18, { type: 'square', volume: 0.12, at: 0.07 });
  },
  /** Boost: ko'tariluvchi arra to'lqin + shamol shovqini */
  boost() {
    tone(180, 0.6, { type: 'sawtooth', volume: 0.15, slideTo: 720 });
    noiseBurst(0.7, { freq: 600, sweepTo: 3000, q: 0.8, volume: 0.35 });
  },
  /** Checkpoint: uch notali arpedjio */
  checkpoint() {
    [659, 784, 988].forEach((f, i) => tone(f, 0.22, { type: 'triangle', volume: 0.22, at: i * 0.07 }));
  },
  /** Marra: fanfara */
  finish() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.7 : 0.18, { type: 'square', volume: 0.14, at: i * 0.13 }));
    [523, 659, 784].forEach((f) => tone(f * 2, 0.9, { type: 'triangle', volume: 0.08, at: 0.4 }));
  },
  /** Countdown: `at` soniyadan keyin qisqa (3-2-1) yoki uzun baland (GO) signal */
  countdownBeep(at: number, go = false) {
    tone(go ? 880 : 440, go ? 0.55 : 0.18, { type: 'square', volume: 0.16, at: Math.max(0, at) });
  },
  /** Urilish: past chastotali shovqin zarbasi */
  impact(strength: number) {
    const v = Math.min(0.5, 0.12 + strength * 0.03);
    noiseBurst(0.25, { freq: 220, type: 'lowpass', volume: v });
    tone(90, 0.2, { type: 'sine', volume: v * 0.8, slideTo: 45 });
  },
  /** Respawn: pastga tushuvchi "vush" */
  respawn() {
    noiseBurst(0.45, { freq: 2500, sweepTo: 300, q: 1.5, volume: 0.25 });
    tone(600, 0.35, { type: 'sine', volume: 0.1, slideTo: 200 });
  },
};
