import { useEffect, useState } from 'react';
import { OrbitControls } from '@react-three/drei';
import { ChaseCamera } from './ChaseCamera';

/** C tugmasi bilan chase kamera va erkin (orbit) kamera orasida almashish — debug uchun */
export function CameraRig() {
  const [free, setFree] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyC') setFree((f) => !f);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return free ? <OrbitControls makeDefault /> : <ChaseCamera />;
}
