import { findCosmetic, type CarLook } from '@game/shared';

/** Poyga mashinasi yondan (menyu va garaj uchun sodda rasm); `look` — vizual tuning oldindan ko'rinishi */
export function CarIcon({ color, look, shape = 'buggy' }: { color: string; look?: CarLook; shape?: 'buggy' | 'sport' }) {
  const paint = findCosmetic('paint', look?.paint ?? null)?.color ?? color;
  const rim = findCosmetic('rim', look?.rim ?? null)?.color ?? '#d9d4cc';
  const neon = findCosmetic('neon', look?.neon ?? null)?.color;
  const spoiler = look?.spoiler ?? null;
  return (
    <svg viewBox="0 0 64 28" aria-hidden="true">
      {neon && <ellipse cx="32" cy="24" rx="28" ry="3.5" fill={neon} opacity="0.55" />}
      {spoiler && (
        <g fill="#3a2618">
          <rect x="7" y={spoiler === 'high' ? 5 : 8} width="1.6" height={spoiler === 'high' ? 8 : 5} />
          <rect x="3" y={spoiler === 'high' ? 4 : 7} width="10" height="2" rx="0.6" fill={look?.paint ? paint : '#3a2618'} />
        </g>
      )}
      {shape === 'sport' ? (
        <>
          {/* Past, uzun sport mashina: pona shakli, orqada kichik qanot */}
          <path d="M3 18 L5 14 L20 12 L30 8 L42 8 L52 12 L61 14 L61 18 Z" fill={paint} stroke="#3a2618" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M31 9 L41 9 L48 12 L25 12 Z" fill="#2a2a2e" />
          <rect x="3" y="11" width="7" height="1.8" rx="0.6" fill="#3a2618" />
        </>
      ) : (
        <>
          <path d="M4 17 L10 12 L26 11 L32 5 L40 5 L44 11 L58 12 L60 18 L4 19 Z" fill={paint} stroke="#3a2618" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M33 6 L39 6 L42 11 L30 11 Z" fill="#4d6078" />
          <rect x="54" y="6" width="6" height="3" rx="1" fill="#3a2618" />
        </>
      )}
      <circle cx="15" cy="20" r={shape === 'sport' ? 4.5 : 6} fill="#3a3330" />
      <circle cx="15" cy="20" r="2.4" fill={rim} />
      <circle cx="50" cy="20" r={shape === 'sport' ? 4.5 : 6} fill="#3a3330" />
      <circle cx="50" cy="20" r="2.4" fill={rim} />
    </svg>
  );
}
