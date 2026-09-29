import { useEffect, type CSSProperties } from 'react';
import { input, requestRespawn } from '../../input/keyboard';
import { holdProps, releaseAllTouch, steerZoneProps, haptic } from '../../input/touch';
import { calibrateTilt } from '../../input/tilt';
import { isTouch } from '../../store/device';
import { useControls } from '../../store/controls';
import { useCameraStore } from '../../store/cameraStore';
import { ownCarStats } from '../../store/garage';
import { useAnimationFrame } from './useAnimationFrame';

/**
 * Sensorli ekran boshqaruvi (faqat telefon/planshetda):
 *  chap-past — ◀ ▶ rul (tilt rejimida yo'q) | o'ng-past — gaz, tormoz, drift, nitro
 *  o'ng-tepa (ovoz/chiqish ostida) — trassaga qaytish, kamera, orqaga qarash
 */
export function TouchControls() {
  const { scheme, autoAccel, buttonScale, leftHanded } = useControls();
  const hasNitro = ownCarStats().nitroCapacityMs > 0;

  // Avto-gaz: tormoz bosilmagan bo'lsa gaz doim bosilgan
  useAnimationFrame(() => {
    if (autoAccel) input.forward = !input.backward;
  });

  // Poyga ekranidan chiqilganda barmoqlar "yopishib" qolmasin
  useEffect(
    () => () => {
      releaseAllTouch();
      if (autoAccel) input.forward = false;
    },
    [autoAccel],
  );

  if (!isTouch) return null;

  return (
    <div
      className={`touch-controls${leftHanded ? ' lh' : ''}`}
      style={{ '--tc-scale': buttonScale } as CSSProperties}
    >
      <div className="tc-utils">
        <button className="tc-small" onPointerDown={() => (haptic(), requestRespawn())} aria-label="Trassaga qaytish">
          ⟲
        </button>
        <button className="tc-small" onPointerDown={() => (haptic(), useCameraStore.getState().cycle())} aria-label="Kamera">
          🎥
        </button>
        <button className="tc-small" {...holdProps('lookBack')} aria-label="Orqaga qarash">
          👀
        </button>
        {scheme === 'tilt' && (
          <button className="tc-small" onPointerDown={() => (haptic(), calibrateTilt())} aria-label="Rulni kalibrlash">
            ⊙
          </button>
        )}
      </div>

      {scheme === 'buttons' && (
        <div className="tc-steer" {...steerZoneProps}>
          <span className="tc-btn tc-left">◀</span>
          <span className="tc-btn tc-right">▶</span>
        </div>
      )}

      <div className="tc-pedals">
        <div className="tc-col">
          {hasNitro && (
            <button className="tc-btn tc-nitro" {...holdProps('nitro')}>
              NITRO
            </button>
          )}
          <button className="tc-btn tc-drift" {...holdProps('handbrake')}>
            DRIFT
          </button>
        </div>
        <div className="tc-col">
          {!autoAccel && (
            <button className="tc-btn tc-gas" {...holdProps('forward')}>
              GAZ
            </button>
          )}
          <button className="tc-btn tc-brake" {...holdProps('backward')}>
            TORMOZ
          </button>
        </div>
      </div>
    </div>
  );
}
