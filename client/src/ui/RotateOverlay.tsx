import { isTouch, useDevice } from '../store/device';

/** Sensorli qurilma portret holatda bo'lsa — o'yin faqat landshaftda, telefonni aylantirish so'raladi */
export function RotateOverlay() {
  const portrait = useDevice((s) => s.portrait);
  if (!isTouch || !portrait) return null;
  return (
    <div className="rotate-overlay">
      <div className="rotate-icon">📱</div>
      <strong>Telefonni aylantiring</strong>
      <span>O'yin yotiq (landshaft) holatda o'ynaladi</span>
    </div>
  );
}
