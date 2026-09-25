import { useMemo } from 'react';
import { SpotLight } from 'three';
import { useTrack } from '../../store/raceSettings';

/**
 * Tungi trassada o'z mashinamizning faralari: bitta soyasiz SpotLight (mashina bilan birga harakatlanadi).
 * Faqat o'yinchi mashinasida — bot va onlayn raqiblarda chiroq yo'q (unumdorlik).
 */
export function Headlights() {
  const night = !!useTrack().def.env?.night;
  const light = useMemo(() => {
    const l = new SpotLight('#fff1d6', 90, 75, 0.52, 0.6, 1);
    l.position.set(0, 0.9, 1.9);
    l.target.position.set(0, -0.6, 20);
    return l;
  }, []);
  if (!night) return null;
  return (
    <>
      <primitive object={light} />
      <primitive object={light.target} />
    </>
  );
}
