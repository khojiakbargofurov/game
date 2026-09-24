import { backToMenu } from '../net/session';
import { useNetStore } from '../store/netStore';

/** Poyga paytida menyuga qaytish (onlayn — xonadan ham chiqiladi) */
export function ExitButton() {
  const mode = useNetStore((s) => s.mode);
  return (
    <button className="hud-button" onClick={(e) => (e.currentTarget.blur(), backToMenu())}>
      {mode === 'online' ? 'Xonadan chiqish' : 'Menyu'}
    </button>
  );
}
