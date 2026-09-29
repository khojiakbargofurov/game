import { useState } from 'react';
import { runInstallPrompt, useInstallMode } from '../../store/pwa';

/** Yuqori paneldagi "O'rnatish" tugmasi — o'yinni telefon bosh ekraniga ilova sifatida qo'shish */
export function InstallChip() {
  const mode = useInstallMode();
  const [iosHint, setIosHint] = useState(false);
  if (!mode) return null;
  return (
    <div className="hub-install">
      <button
        className="hub-chip hub-install-btn"
        onClick={() => (mode === 'prompt' ? void runInstallPrompt() : setIosHint((v) => !v))}
      >
        📲 O'rnatish
      </button>
      {iosHint && (
        <div className="hub-install-hint" onClick={() => setIosHint(false)}>
          Safari'da pastdagi <b>Ulashish ⬆︎</b> tugmasini bosing va <b>«Bosh ekranga qo'shish»</b> ni tanlang — o'yin
          to'liq ekranli ilova bo'lib ochiladi.
        </div>
      )}
    </div>
  );
}
