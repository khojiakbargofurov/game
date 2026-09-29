import { useEffect, useState } from 'react';
import { QUALITY_LABELS, useQuality } from '../../store/quality';

const SHOW_MS = 3500;

/** FPS past bo'lgani uchun grafika sifati avtomatik pasaytirilganda qisqa xabar */
export function QualityToast() {
  const at = useQuality((s) => s.autoDowngradedAt);
  const quality = useQuality((s) => s.quality);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!at) return;
    setVisible(true);
    const id = setTimeout(() => setVisible(false), SHOW_MS);
    return () => clearTimeout(id);
  }, [at]);
  return (
    <div className={`camera-toast quality-toast ${visible ? '' : 'faded'}`}>
      ⚙️ Grafika: {QUALITY_LABELS[quality]} — o'yin silliqroq bo'lishi uchun
    </div>
  );
}
