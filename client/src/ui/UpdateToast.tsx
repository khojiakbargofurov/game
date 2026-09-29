import { useRegisterSW } from 'virtual:pwa-register/react';

/** Soatiga bir marta yangi versiya bor-yo'qligi tekshiriladi (ilova uzoq ochiq tursa) */
const CHECK_MS = 60 * 60 * 1000;

/**
 * Service worker ro'yxatdan o'tkaziladi. Yangi versiya yuklansa — faqat menyuda "Yangilash" tugmasi
 * (poyga o'rtasida sahifa o'z-o'zidan qayta yuklanmasin).
 */
export function UpdateToast({ visible }: { visible: boolean }) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (reg) setInterval(() => void reg.update(), CHECK_MS);
    },
  });
  if (!visible || !needRefresh) return null;
  return (
    <div className="update-toast">
      <span>🚀 Yangi versiya tayyor</span>
      <button className="primary" onClick={() => void updateServiceWorker(true)}>
        Yangilash
      </button>
      <button onClick={() => setNeedRefresh(false)} aria-label="Keyinroq">
        ✕
      </button>
    </div>
  );
}
