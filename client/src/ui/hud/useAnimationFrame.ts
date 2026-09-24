import { useEffect, useRef } from 'react';

/** Har kadrda callback (React re-render'siz DOM yangilash uchun) */
export function useAnimationFrame(cb: (now: number) => void) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    let id = requestAnimationFrame(function loop(now) {
      ref.current(now);
      id = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(id);
  }, []);
}
