import { create } from 'zustand';
import { useNetStore } from './netStore';

/**
 * Qurilma holati: sensorli ekranmi va ekran yo'nalishi.
 * `?touch=1` — desktopda ham sensorli boshqaruvni ko'rsatish (sinash uchun).
 */
const forceTouch = new URLSearchParams(location.search).get('touch') === '1';

export const isTouch: boolean =
  forceTouch || matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const isPortrait = () => window.innerHeight > window.innerWidth;

interface DeviceState {
  portrait: boolean;
}

export const useDevice = create<DeviceState>(() => ({ portrait: isPortrait() }));

const onResize = () => useDevice.setState({ portrait: isPortrait() });
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);

if (isTouch) document.documentElement.classList.add('touch');

/**
 * Sensorli qurilmada menyudan chiqilganda (poyga/xona) — to'liq ekran va landshaftga qulflash.
 * Brauzer foydalanuvchi harakatini talab qiladi: tugma bosilishi bilan bir xil tikda chaqiriladi.
 * iOS Safari qo'llamaydi — xatolar e'tiborsiz qoldiriladi (portretda RotateOverlay ko'rinadi).
 */
export function enterGameFullscreen() {
  if (!isTouch || document.fullscreenElement) return;
  const el = document.documentElement;
  el.requestFullscreen?.({ navigationUI: 'hide' })
    .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
    .catch(() => {});
}

useNetStore.subscribe((s, prev) => {
  if (prev.screen === 'menu' && s.screen !== 'menu') enterGameFullscreen();
});
