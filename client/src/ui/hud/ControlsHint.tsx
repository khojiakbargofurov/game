import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';

const SHOW_MS = 7000;

/** Boshqaruv eslatmasi — poyga boshida bir necha soniya ko'rinadi, keyin yo'qoladi */
export function ControlsHint() {
  const startedAt = useGameStore((s) => s.startedAt);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    if (!startedAt) return;
    const id = setTimeout(() => setVisible(false), SHOW_MS);
    return () => clearTimeout(id);
  }, [startedAt]);
  return (
    <div className={`hint ${visible ? '' : 'faded'}`}>
      ↑↓ / W S gaz/tormoz · ←→ / A D rul · Space drift · R checkpointga qaytish · M ovoz · C kamera
    </div>
  );
}
