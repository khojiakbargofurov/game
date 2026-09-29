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

/**
 * iOS: Web Audio telefonning jim rejim (silent) tugmasiga bo'ysunadi — o'yin ovozi umuman chiqmaydi.
 * Safari 16.4+ da audioSession 'playback' — musiqa ilovasidek jim rejimda ham chalinadi;
 * eski versiyalar uchun — jim <audio> elementi chalinib turadi (u ham sessiyani playback'ga o'tkazadi).
 */
const nav = navigator as Navigator & { audioSession?: { type: string } };
if (nav.audioSession) nav.audioSession.type = 'playback';

let silentEl: HTMLAudioElement | null = null;
function playSilentElement() {
  if (nav.audioSession || silentEl) return;
  // 0.1s jim WAV (8 kHz, 8-bit mono)
  const samples = 800;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const str = (o: number, t: string) => [...t].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  str(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  str(36, 'data');
  view.setUint32(40, samples, true);
  bytes.fill(128, 44);
  silentEl = new Audio(URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' })));
  silentEl.loop = true;
  silentEl.setAttribute('playsinline', '');
  silentEl.play().catch(() => (silentEl = null)); // keyingi bosishda qayta uriniladi
}

function unlock() {
  playSilentElement();
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
  // iOS'da holat 'interrupted' ham bo'ladi (qo'ng'iroq, fonga o'tish) — faqat 'suspended' emas
  if (ctx.state !== 'running') void ctx.resume();
}

window.addEventListener('pointerdown', unlock);
// iOS Safari AudioContext'ni faqat touchend'dan keyin ochadi (pointerdown/touchstart yetarli emas)
window.addEventListener('touchend', unlock);
window.addEventListener('click', unlock);
// Ilova fonga o'tsa ovoz to'xtaydi (telefon batareyasi), qaytganda davom etadi
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) {
    void ctx.suspend();
    silentEl?.pause();
  } else {
    void ctx.resume();
    void silentEl?.play().catch(() => {});
  }
});
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
