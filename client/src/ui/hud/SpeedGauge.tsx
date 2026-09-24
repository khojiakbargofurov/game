import { useRef } from 'react';
import { CAR } from '@game/shared';
import { carTarget } from '../../game/carTarget';
import { useGameStore } from '../../store/gameStore';
import { useAnimationFrame } from './useAnimationFrame';
import { ownCarStats } from '../../store/garage';

const MAX_KMH = Math.round(CAR.MAX_SPEED * CAR.BOOST_MULTIPLIER * 3.6); // shkala oxiri (boost bilan)
const R = 54;
const SWEEP = 240; // daraja
const ARC_LEN = (2 * Math.PI * R * SWEEP) / 360;

/** Yoy nuqtasi: burchak -120°..+120° (0 = tepada) */
function polar(deg: number, r = R) {
  const a = ((deg - 90) * Math.PI) / 180;
  return `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
}
const ARC_PATH = `M ${polar(-SWEEP / 2)} A ${R} ${R} 0 1 1 ${polar(SWEEP / 2)}`;

/** Tezlik shkalasi (yoy) + km/h + boost indikatori. Har kadrda DOM to'g'ridan-to'g'ri yangilanadi */
export function SpeedGauge() {
  const fill = useRef<SVGPathElement>(null);
  const value = useRef<HTMLSpanElement>(null);
  const boostBar = useRef<HTMLDivElement>(null);
  const shown = useRef(0);

  useAnimationFrame(() => {
    const kmh = Math.abs(carTarget.speed) * 3.6;
    shown.current += (kmh - shown.current) * 0.25;
    const ratio = Math.min(shown.current / MAX_KMH, 1);
    if (fill.current) {
      fill.current.style.strokeDashoffset = String(ARC_LEN * (1 - ratio));
      // Maksimal tezlikdan oshsa (boost) — rang o'zgaradi
      fill.current.classList.toggle('over', shown.current > CAR.MAX_SPEED * 3.6 + 2);
    }
    if (value.current) value.current.textContent = String(Math.round(shown.current));
    const left = useGameStore.getState().boostUntil - performance.now();
    if (boostBar.current) {
      boostBar.current.style.transform = `scaleX(${Math.max(0, left) / ownCarStats().boostDurationMs})`;
      boostBar.current.parentElement!.hidden = left <= 0;
    }
  });

  return (
    <div className="gauge">
      <svg viewBox="-64 -64 128 110">
        <path className="gauge-track" d={ARC_PATH} />
        <path ref={fill} className="gauge-fill" d={ARC_PATH} strokeDasharray={ARC_LEN} strokeDashoffset={ARC_LEN} />
      </svg>
      <div className="gauge-text">
        <span ref={value}>0</span>
        <small>km/h</small>
      </div>
      <div className="boost-meter" hidden>
        <div ref={boostBar} />
        <em>BOOST</em>
      </div>
    </div>
  );
}
