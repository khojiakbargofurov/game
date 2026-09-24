import { findCosmetic, type CarIconShape, type CarLook } from '@game/shared';

/** Yondan ko'rinish (viewBox 64×28, old tomon — o'ngda): kuzov, oyna, g'ildirak radiusi */
const SHAPES: Record<CarIconShape, { body: string; glass: string; wheel: number; wing?: boolean }> = {
  buggy: { body: 'M4 17 L10 12 L26 11 L32 5 L40 5 L44 11 L58 12 L60 18 L4 19 Z', glass: 'M33 6 L39 6 L42 11 L30 11 Z', wheel: 6, wing: true },
  sport: { body: 'M3 18 L5 14 L20 12 L30 8 L42 8 L52 12 L61 14 L61 18 Z', glass: 'M31 9 L41 9 L48 12 L25 12 Z', wheel: 4.5 },
  sedan: { body: 'M3 18 L4 13 L14 12 L21 7 L41 7 L48 12 L60 13 L61 18 Z', glass: 'M22 8 L40 8 L45 12 L18 12 Z', wheel: 5 },
  hatch: { body: 'M4 18 L4 11 L10 6 L36 6 L44 11 L58 13 L59 18 Z', glass: 'M11 7 L35 7 L41 11 L7 11 Z', wheel: 5 },
  wagon: { body: 'M3 18 L3 11 L8 6 L42 6 L49 12 L60 13 L61 18 Z', glass: 'M9 7 L41 7 L46 11 L6 11 Z', wheel: 5 },
  van: { body: 'M4 19 L4 7 L10 3 L46 3 L56 11 L60 13 L60 19 Z', glass: 'M11 5 L45 5 L52 10 L8 10 Z', wheel: 5 },
  suv: { body: 'M3 18 L3 9 L9 4 L44 4 L50 10 L60 11 L61 18 Z', glass: 'M10 5 L42 5 L47 9 L7 9 Z', wheel: 6 },
  pickup: { body: 'M3 18 L3 11 L30 11 L32 5 L44 5 L50 11 L60 12 L61 18 Z', glass: 'M33 6 L43 6 L47 10 L32 10 Z', wheel: 6 },
};

/** Mashina yondan (menyu va garaj uchun sodda rasm); `look` — vizual tuning oldindan ko'rinishi */
export function CarIcon({ color, look, shape = 'buggy' }: { color: string; look?: CarLook; shape?: CarIconShape }) {
  const paint = findCosmetic('paint', look?.paint ?? null)?.color ?? color;
  const rim = findCosmetic('rim', look?.rim ?? null)?.color ?? '#d9d4cc';
  const neon = findCosmetic('neon', look?.neon ?? null)?.color;
  const spoiler = look?.spoiler ?? null;
  const s = SHAPES[shape];
  return (
    <svg viewBox="0 0 64 28" aria-hidden="true">
      {neon && <ellipse cx="32" cy="24" rx="28" ry="3.5" fill={neon} opacity="0.55" />}
      {spoiler && (
        <g fill="#3a2618">
          <rect x="7" y={spoiler === 'high' ? 5 : 8} width="1.6" height={spoiler === 'high' ? 8 : 5} />
          <rect x="3" y={spoiler === 'high' ? 4 : 7} width="10" height="2" rx="0.6" fill={look?.paint ? paint : '#3a2618'} />
        </g>
      )}
      <path d={s.body} fill={paint} stroke="#3a2618" strokeWidth="1.2" strokeLinejoin="round" />
      <path d={s.glass} fill={shape === 'buggy' ? '#4d6078' : '#2a2a2e'} />
      {s.wing && <rect x="54" y="6" width="6" height="3" rx="1" fill="#3a2618" />}
      {[15, 50].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="20" r={s.wheel} fill="#3a3330" />
          <circle cx={cx} cy="20" r="2.4" fill={rim} />
        </g>
      ))}
    </svg>
  );
}
