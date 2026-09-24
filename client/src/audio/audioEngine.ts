/**
 * Web Audio asosi: bitta AudioContext, master gain va ovozni o'chirish (M tugmasi).
 * Brauzerlar ovozni faqat foydalanuvchi harakatidan keyin ruxsat beradi — kontekst
 * birinchi bosish/tugmada yaratiladi. Barcha ovozlar kodda generatsiya qilinadi (fayl yo'q).
 */

const MUTE_KEY = 'racer:muted';
const MASTER_VOLUME = 0.7;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMuted();
const listeners = new Set<(muted: boolean) => void>();
const readyCallbacks: ((ctx: AudioContext, out: AudioNode) => void)[] = [];

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function unlock() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_VOLUME;
    // Yumshoq kompressor — bir vaqtda ko'p effekt bo'lsa ham "yorilmasin"
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    readyCallbacks.splice(0).forEach((cb) => cb(ctx!, master!));
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', (e) => {
  unlock();
  if (e.code === 'KeyM' && !(e.target instanceof HTMLInputElement)) toggleMute();
});

/** Kontekst tayyor bo'lsa — darhol, aks holda birinchi foydalanuvchi harakatidan keyin chaqiriladi */
export function onAudioReady(cb: (ctx: AudioContext, out: AudioNode) => void) {
  if (ctx && master) cb(ctx, master);
  else readyCallbacks.push(cb);
}

export function audio(): { ctx: AudioContext; out: AudioNode } | null {
  return ctx && master && ctx.state === 'running' ? { ctx, out: master } : null;
}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // e'tiborsiz
  }
  if (ctx && master) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, ctx.currentTime, 0.05);
  listeners.forEach((l) => l(muted));
}

export function subscribeMute(l: (muted: boolean) => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}

/** Oq shovqin buferi (bir marta yaratiladi) — shamol, shinalar, urilish uchun */
let noiseBuffer: AudioBuffer | null = null;
export function noise(ctx: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}
