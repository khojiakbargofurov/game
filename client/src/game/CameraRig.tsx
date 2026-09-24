import { useEffect, useState } from 'react';
import { OrbitControls } from '@react-three/drei';
import { CameraController } from './CameraController';

/** C tugmasi bilan o'yin kamerasi va erkin (orbit) kamera orasida almashish — debug uchun */
export function CameraRig() {
  const [free, setFree] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyC') setFree((f) => !f);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return free ? <OrbitControls makeDefault /> : <CameraController />;
}
