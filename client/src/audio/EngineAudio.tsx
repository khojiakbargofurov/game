import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { CAR } from '@game/shared';
import { input } from '../input/keyboard';
import { useGameStore } from '../store/gameStore';
import { controlsEnabled, useNetStore } from '../store/netStore';
import { carTarget } from '../game/carTarget';
import { noise, onAudioReady } from './audioEngine';
import { sfx } from './sfx';

/** Uzatmalar chegaralari (m/s): har bir uzatmada "aylanish" pastdan tepaga ko'tariladi */
const GEARS = [0, 7, 14, 21, 29, 38, 60];
const IDLE_FREQ = 42;
const RPM_FREQ = 120;

interface EngineNodes {
  ctx: AudioContext;
  saw: OscillatorNode;
  square: OscillatorNode;
  sub: OscillatorNode;
  filter: BiquadFilterNode;
  engineGain: GainNode;
  tireGain: GainNode;
  windGain: GainNode;
  windFilter: BiquadFilterNode;
}

/** Dvigatel, shina va shamol ovozi uchun doimiy tugunlar grafini qurish */
function buildEngine(ctx: AudioContext, out: AudioNode): EngineNodes {
  const engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 600;
  filter.Q.value = 4;
  // Biroz "xirillash" — yumshoq distorsiya
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * 2 - 1;
    curve[i] = Math.tanh(2.2 * x);
  }
  shaper.curve = curve;

  const mix = ctx.createGain();
  mix.gain.value = 0.5;
  const mk = (type: OscillatorType, vol: number) => {
    const o = ctx.createOscillator();
    o.type = type;
    const g = ctx.createGain();
    g.gain.value = vol;
    o.connect(g).connect(mix);
    o.start();
    return o;
  };
  const saw = mk('sawtooth', 0.5);
  const square = mk('square', 0.3);
  const sub = mk('sine', 0.8);
  mix.connect(shaper).connect(filter).connect(engineGain).connect(out);

  // Shovqin manbasi: shinalar (bandpass) va shamol (lowpass)
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  src.loop = true;
  const tireFilter = ctx.createBiquadFilter();
  tireFilter.type = 'bandpass';
  tireFilter.frequency.value = 1900;
  tireFilter.Q.value = 6;
  const tireGain = ctx.createGain();
  tireGain.gain.value = 0;
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'lowpass';
  windFilter.frequency.value = 400;
  const windGain = ctx.createGain();
  windGain.gain.value = 0;
  src.connect(tireFilter).connect(tireGain).connect(out);
  src.connect(windFilter).connect(windGain).connect(out);
  src.start();

  return { ctx, saw, square, sub, filter, engineGain, tireGain, windGain, windFilter };
}

/** Joriy tezlikdan "aylanish" (0..1) — uzatma ichidagi ulush */
function rpmFromSpeed(speed: number): number {
  const v = Math.abs(speed);
  for (let g = 1; g < GEARS.length; g++) {
    if (v < GEARS[g]) {
      const t = (v - GEARS[g - 1]) / (GEARS[g] - GEARS[g - 1]);
      return g === 1 ? t * 0.8 : 0.35 + t * 0.6;
    }
  }
  return 1;
}

const right = new Vector3();
const lastVel = new Vector3();

/**
 * Har kadrda dvigatel ovozini mashina holatiga moslaydi:
 * chastota — tezlik/uzatma, balandlik va filtr — gaz, shina — yon sirpanish, shamol — tezlik.
 * Keskin sekinlashishni urilish deb aniqlaydi.
 */
export function EngineAudio() {
  const nodes = useRef<EngineNodes | null>(null);
  const lastRespawns = useRef(carTarget.respawns);
  const impactCooldown = useRef(0);

  useEffect(() => onAudioReady((ctx, out) => (nodes.current ??= buildEngine(ctx, out))), []);

  useFrame((_, dt) => {
    const n = nodes.current;
    if (!n) return;
    const t = n.ctx.currentTime;
    const smooth = 0.06;
    const inRace = useNetStore.getState().screen === 'race';
    const phase = useGameStore.getState().phase;
    const speed = carTarget.speed;
    const throttle = controlsEnabled() && (input.forward || input.backward) ? 1 : 0;

    // Dvigatel
    const rpm = Math.max(rpmFromSpeed(speed), throttle ? 0.2 : 0.08);
    const freq = IDLE_FREQ + rpm * RPM_FREQ;
    n.saw.frequency.setTargetAtTime(freq, t, smooth);
    n.square.frequency.setTargetAtTime(freq * 0.5, t, smooth);
    n.sub.frequency.setTargetAtTime(freq * 0.25, t, smooth);
    n.filter.frequency.setTargetAtTime(350 + rpm * 900 + throttle * 900, t, smooth);
    const engineVol = inRace ? 0.07 + throttle * 0.07 + rpm * 0.04 : 0;
    n.engineGain.gain.setTargetAtTime(engineVol, t, 0.1);

    // Shinalar: yon tezlik (drift) va qo'l tormozi
    right.set(1, 0, 0).applyQuaternion(carTarget.quaternion);
    const lateral = Math.abs(right.dot(carTarget.velocity));
    const skid = inRace ? Math.min(0.22, Math.max(0, lateral - 3.5) * 0.03 + (input.handbrake && Math.abs(speed) > 5 ? 0.08 : 0)) : 0;
    n.tireGain.gain.setTargetAtTime(skid, t, 0.05);

    // Shamol: tezlik oshgan sari balandroq va "ochiqroq"
    const ratio = Math.min(Math.abs(speed) / (CAR.MAX_SPEED * CAR.BOOST_MULTIPLIER), 1);
    n.windGain.gain.setTargetAtTime(inRace ? ratio * ratio * 0.18 : 0, t, 0.2);
    n.windFilter.frequency.setTargetAtTime(300 + ratio * 1500, t, 0.2);

    // Respawn va urilish effektlari (faqat poyga paytida)
    const racing = inRace && (phase === 'racing' || phase === 'finished');
    if (carTarget.respawns !== lastRespawns.current) {
      lastRespawns.current = carTarget.respawns;
      if (racing) sfx.respawn();
      lastVel.copy(carTarget.velocity);
      return;
    }
    impactCooldown.current -= dt;
    const dv = lastVel.distanceTo(carTarget.velocity);
    // 60 FPS da bir kadrda >7 m/s o'zgarish — tabiiy tormozlanish emas, urilish
    if (racing && dv > 7 && dt < 0.05 && impactCooldown.current <= 0) {
      sfx.impact(dv);
      impactCooldown.current = 0.3;
    }
    lastVel.copy(carTarget.velocity);
  });

  return null;
}
