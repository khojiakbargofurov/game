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

type HeldAction = 'forward' | 'backward' | 'left' | 'right' | 'handbrake';

/** Strelkalar va WASD — bir xil amallar (e.code klaviatura tartibidan qat'i nazar joylashuv bo'yicha) */
const KEY_MAP: Record<string, HeldAction> = {
  ArrowUp: 'forward',
  KeyW: 'forward',
  ArrowDown: 'backward',
  KeyS: 'backward',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'handbrake',
};

/** Hozir bosib turilgan tugmalar: bitta amalga ikki tugma (↑ va W) — biri qo'yilsa, ikkinchisi ishlayveradi */
const held = new Set<string>();

function refresh(action: HeldAction) {
  input[action] = [...held].some((code) => KEY_MAP[code] === action);
}

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA';
}

function onKey(e: KeyboardEvent, down: boolean) {
  if (isTyping(e)) return;
  const action = KEY_MAP[e.code];
  if (action) {
    if (down) held.add(e.code);
    else held.delete(e.code);
    refresh(action);
    e.preventDefault(); // sahifa scroll bo'lmasin
  } else if (e.code === 'KeyR' && down && !e.repeat) {
    input.respawn = true;
  }
}

const onDown = (e: KeyboardEvent) => onKey(e, true);
const onUp = (e: KeyboardEvent) => onKey(e, false);
/** Oyna fokusni yo'qotsa tugmalar "yopishib" qolmasin */
const onBlur = () => {
  held.clear();
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
