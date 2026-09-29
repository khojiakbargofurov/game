import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { input } from './keyboard';
import { useControls } from '../store/controls';

/**
 * Ekran tugmalari — har bir tugma o'z barmog'ini (pointerId) kuzatadi, shuning uchun
 * bir vaqtda gaz + rul + nitro bosib turish mumkin. Barmoq tugmadan chiqib ketsa ham
 * (pointer capture) qo'yib yuborilguncha bosilgan hisoblanadi.
 */
export type TouchAction = 'forward' | 'backward' | 'left' | 'right' | 'handbrake' | 'nitro' | 'lookBack';

/** Qaysi barmoq qaysi amalni ushlab turibdi */
const held = new Map<number, TouchAction>();

function refresh(action: TouchAction) {
  input[action] = [...held.values()].includes(action);
}

export function haptic(ms = 12) {
  if (useControls.getState().haptics) navigator.vibrate?.(ms);
}

/** Barmoq tugmadan chiqib ketsa ham shu tugmaga bog'liq qolsin (capture ba'zan rad etilishi mumkin) */
function capture(e: ReactPointerEvent<HTMLElement>) {
  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {
    // e'tiborsiz
  }
}

function press(e: ReactPointerEvent<HTMLElement>, action: TouchAction) {
  e.preventDefault();
  capture(e);
  held.set(e.pointerId, action);
  refresh(action);
  haptic();
}

function release(e: ReactPointerEvent<HTMLElement>) {
  const action = held.get(e.pointerId);
  if (!action) return;
  held.delete(e.pointerId);
  refresh(action);
}

/** Tugmaga yoyiladigan pointer handlerlar: `<button {...holdProps('forward')} />` */
export function holdProps(action: TouchAction) {
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => press(e, action),
    onPointerUp: release,
    onPointerCancel: release,
    onLostPointerCapture: release,
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
  };
}

/**
 * Rul zonasi: bitta barmoq ◀ va ▶ orasida sirpanib o'tishi mumkin —
 * zona markazidan chapda bo'lsa chapga, o'ngda bo'lsa o'ngga.
 */
function steerFrom(e: ReactPointerEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  const action: TouchAction = e.clientX < r.left + r.width / 2 ? 'left' : 'right';
  const prev = held.get(e.pointerId);
  if (prev === action) return;
  held.set(e.pointerId, action);
  if (prev) refresh(prev);
  refresh(action);
  haptic(8);
}

export const steerZoneProps = {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault();
    capture(e);
    steerFrom(e);
  },
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
    if (held.has(e.pointerId)) steerFrom(e);
  },
  onPointerUp: release,
  onPointerCancel: release,
  onLostPointerCapture: release,
};

/** Hamma barmoqlarni qo'yib yuborish (fonga o'tish, poyga tugashi) — tugma "yopishib" qolmasin */
export function releaseAllTouch() {
  const actions = new Set(held.values());
  held.clear();
  actions.forEach(refresh);
}

window.addEventListener('blur', releaseAllTouch);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) releaseAllTouch();
});
