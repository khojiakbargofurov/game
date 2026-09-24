import { useEffect, useState } from 'react';
import { isMuted, subscribeMute, toggleMute } from '../../audio/audioEngine';

/** Ovozni yoqish/o'chirish (M tugmasi ham ishlaydi) */
export function MuteButton() {
  const [muted, setMuted] = useState(isMuted);
  useEffect(() => subscribeMute(setMuted), []);
  return (
    <button
      className="hud-button"
      title="Ovoz (M)"
      onClick={(e) => {
        e.currentTarget.blur();
        toggleMute();
      }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
