import { create } from 'zustand';

/** 3D dunyo (fizika + relyef + manzara) tayyormi — countdown faqat shundan keyin boshlanadi */
export const useLoadState = create<{ worldReady: boolean; readyAt: number | null }>(() => ({
  worldReady: false,
  /** performance.now() — dunyo tayyor bo'lgan vaqt (yuklanishni o'lchash uchun) */
  readyAt: null,
}));

/** Dunyo tayyor bo'lganda (yoki allaqachon tayyor bo'lsa — darhol) callback chaqirish */
export function whenWorldReady(cb: () => void): () => void {
  if (useLoadState.getState().worldReady) {
    cb();
    return () => undefined;
  }
  const unsub = useLoadState.subscribe((s) => {
    if (s.worldReady) {
      unsub();
      cb();
    }
  });
  return unsub;
}
