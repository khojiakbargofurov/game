import { useEffect, useState } from 'react';
import { CAMERA } from '@game/shared';
import { useCameraStore } from '../../store/cameraStore';

const SHOW_MS = 1200;

/** Kamera rejimi almashganda qisqa yorliq (masalan, "📷 Kapot") */
export function CameraToast() {
  const mode = useCameraStore((s) => s.mode);
  const changedAt = useCameraStore((s) => s.changedAt);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!changedAt) return;
    setVisible(true);
    const id = setTimeout(() => setVisible(false), SHOW_MS);
    return () => clearTimeout(id);
  }, [changedAt]);
  return <div className={`camera-toast ${visible ? '' : 'faded'}`}>📷 {CAMERA.MODES[mode].label}</div>;
}
