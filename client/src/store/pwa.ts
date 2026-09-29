import { create } from 'zustand';
import { isTouch } from './device';

/**
 * PWA o'rnatish holati.
 *  - Android/Chrome: brauzer `beforeinstallprompt` beradi — uni saqlab, o'z tugmamizdan chaqiramiz
 *  - iOS Safari: dasturiy taklif yo'q — "Ulashish → Bosh ekranga qo'shish" yo'riqnomasi ko'rsatiladi
 *  - Allaqachon o'rnatilgan (standalone) bo'lsa tugma ko'rinmaydi
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * O'rnatilgan ilova: manifest start_url'dagi `?app=1`, standalone rejim yoki iOS `navigator.standalone`.
 * `display-mode: fullscreen` ishlatilmaydi — u oddiy brauzer to'liq ekranga o'tganda ham rost bo'ladi.
 */
export const isStandalone =
  new URLSearchParams(location.search).has('app') ||
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

interface PwaState {
  prompt: InstallPromptEvent | null;
  installed: boolean;
}

export const usePwa = create<PwaState>(() => ({ prompt: null, installed: isStandalone }));

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // brauzerning o'z bannerini emas, menyudagi tugmani ko'rsatamiz
  usePwa.setState({ prompt: e as InstallPromptEvent });
});
window.addEventListener('appinstalled', () => usePwa.setState({ prompt: null, installed: true }));

/** "O'rnatish" tugmasi qaysi usulda ishlaydi: brauzer taklifi, iOS yo'riqnomasi yoki umuman yo'q */
export function useInstallMode(): 'prompt' | 'ios' | null {
  const { prompt, installed } = usePwa();
  if (installed) return null;
  if (prompt) return 'prompt';
  return isIOS && isTouch ? 'ios' : null;
}

export async function runInstallPrompt() {
  const { prompt } = usePwa.getState();
  if (!prompt) return;
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  usePwa.setState({ prompt: null, installed: outcome === 'accepted' });
}
