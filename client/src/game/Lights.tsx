import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { DirectionalLight } from 'three';
import { LIGHTING } from '@game/shared';
import { carTarget } from './carTarget';
import { usePreset } from '../store/quality';
import { usePalette, useTrack, useWeatherFx } from '../store/raceSettings';

const [SX, SY, SZ] = LIGHTING.SUN_POSITION;

/**
 * Quyosh (soyali directional) + hemisphere yorug'lik.
 * Soya kamerasi mashina bilan birga siljiydi — shunda kichik shadow map
 * katta dunyoda ham aniq soya beradi.
 */
export function Lights() {
  const sun = useRef<DirectionalLight>(null);
  const { shadows, shadowMapSize } = usePreset();
  // Fasl ranglari; bulutli (yomg'ir/qor) havoda quyosh xiraroq
  const COLORS = usePalette();
  const { sunScale } = useWeatherFx();
  // Tunda quyosh o'rniga xira ko'kish oy nuri, osmon yorug'ligi ham past (yorug'lik — derazalar, neon, fonarlar, fara)
  const night = !!useTrack().def.env?.night;

  useFrame(() => {
    const light = sun.current;
    if (!light) return;
    const p = carTarget.position;
    light.position.set(p.x + SX, p.y + SY, p.z + SZ);
    light.target.position.copy(p);
    light.target.updateMatrixWorld();
  });

  const e = LIGHTING.SHADOW_EXTENT;
  return (
    <>
      <hemisphereLight
        args={night ? ['#5566aa', '#2a2236', 1.1] : [COLORS.hemiSky, COLORS.hemiGround, LIGHTING.HEMI_INTENSITY]}
      />
      <directionalLight
        ref={sun}
        color={night ? '#9db2ff' : COLORS.sun}
        intensity={LIGHTING.SUN_INTENSITY * sunScale * (night ? 0.22 : 1)}
        castShadow={shadows}
        // key — o'lcham o'zgarsa shadow map qayta yaratiladi
        key={shadowMapSize}
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-left={-e}
        shadow-camera-right={e}
        shadow-camera-top={e}
        shadow-camera-bottom={-e}
        shadow-camera-near={1}
        shadow-camera-far={400}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
      />
    </>
  );
}
