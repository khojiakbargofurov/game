import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

/** Oxirgi o'lchovlar — dev konsolida `__perf()` orqali ham o'qiladi */
export const perfSnapshot = { fps: 0, frameMs: 0, calls: 0, triangles: 0, geometries: 0, textures: 0 };

const SHOW_KEY = 'KeyP';

/**
 * Ishlash ko'rsatkichlari: FPS, kadr vaqti, draw call va uchburchaklar (soyalar bilan birga).
 * P tugmasi yoki `?perf` bilan ko'rsatiladi. DOM to'g'ridan-to'g'ri yangilanadi (re-render yo'q).
 */
export function PerfStats() {
  const gl = useThree((s) => s.gl);
  const el = useRef<HTMLDivElement | null>(null);
  const acc = useRef({ frames: 0, time: 0 });

  useEffect(() => {
    const div = document.createElement('div');
    div.className = 'perf-stats';
    div.hidden = !new URLSearchParams(location.search).has('perf');
    document.body.appendChild(div);
    el.current = div;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === SHOW_KEY && !(e.target instanceof HTMLInputElement)) div.hidden = !div.hidden;
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      div.remove();
    };
  }, []);

  useFrame((_, dt) => {
    // gl.info oldingi kadr ma'lumoti (autoReset render boshida tozalaydi)
    const { render, memory } = gl.info;
    perfSnapshot.calls = render.calls;
    perfSnapshot.triangles = render.triangles;
    perfSnapshot.geometries = memory.geometries;
    perfSnapshot.textures = memory.textures;
    const a = acc.current;
    a.frames++;
    a.time += dt;
    if (a.time < 0.5) return;
    perfSnapshot.fps = a.frames / a.time;
    perfSnapshot.frameMs = (a.time / a.frames) * 1000;
    a.frames = 0;
    a.time = 0;
    if (el.current && !el.current.hidden) {
      const p = perfSnapshot;
      el.current.textContent =
        `${p.fps.toFixed(0)} FPS · ${p.frameMs.toFixed(1)} ms\n` +
        `draw: ${p.calls} · tri: ${(p.triangles / 1000).toFixed(0)}k\n` +
        `geo: ${p.geometries} · tex: ${p.textures}`;
    }
  });

  return null;
}
