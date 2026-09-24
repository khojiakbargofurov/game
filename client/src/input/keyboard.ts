/**
 * Klaviatura holati — mutable obyekt, har kadrda o'qiladi (React re-render yo'q).
 * `respawn` — bir martalik hodisa: o'qilgandan keyin `consumeRespawn()` uni tozalaydi.
 */
export const input = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  handbrake: false,
  respawn: false,
};

const KEY_MAP: Record<string, keyof typeof input> = {
  ArrowUp: 'forward',
  ArrowDown: 'backward',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Space: 'handbrake',
};

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA';
}

function onKey(e: KeyboardEvent, down: boolean) {
  if (isTyping(e)) return;
  const action = KEY_MAP[e.code];
  if (action) {
    input[action] = down;
    e.preventDefault(); // sahifa scroll bo'lmasin
  } else if (e.code === 'KeyR' && down && !e.repeat) {
    input.respawn = true;
  }
}

const onDown = (e: KeyboardEvent) => onKey(e, true);
const onUp = (e: KeyboardEvent) => onKey(e, false);
/** Oyna fokusni yo'qotsa tugmalar "yopishib" qolmasin */
const onBlur = () => {
  input.forward = input.backward = input.left = input.right = input.handbrake = false;
};

/** Dasturiy respawn so'rovi (masalan, "Qayta o'ynash" tugmasi) */
export function requestRespawn() {
  input.respawn = true;
}

export function consumeRespawn(): boolean {
  const r = input.respawn;
  input.respawn = false;
  return r;
}

export function attachKeyboard(): () => void {
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', onBlur);
  return () => {
    window.removeEventListener('keydown', onDown);
    window.removeEventListener('keyup', onUp);
    window.removeEventListener('blur', onBlur);
  };
}
