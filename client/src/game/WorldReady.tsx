import { useEffect } from 'react';
import { useLoadState } from '../store/loadState';

/** Physics Suspense ichida oxirgi element: mount bo'lganda dunyo tayyor (WASM, relyef, colliderlar) */
export function WorldReady() {
  useEffect(() => {
    // Birinchi kadr chizilishini kutamiz (shader kompilyatsiyasi ham tugasin)
    const id = requestAnimationFrame(() => useLoadState.setState({ worldReady: true, readyAt: performance.now() }));
    return () => {
      cancelAnimationFrame(id);
      // Canvas qayta yaratilsa (sifat o'zgarganda) — dunyo qaytadan yuklanadi
      useLoadState.setState({ worldReady: false });
    };
  }, []);
  return null;
}
