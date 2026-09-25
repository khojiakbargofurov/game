import { useEffect, useState } from 'react';
import { loadName, saveName } from '../net/session';
import { Credits } from './Credits';
import { TopBar } from './menu/TopBar';
import { HomeScreen } from './menu/HomeScreen';
import { CarsScreen } from './menu/CarsScreen';
import { RaceScreen } from './menu/RaceScreen';
import { OnlineScreen } from './menu/OnlineScreen';
import { SettingsScreen } from './menu/SettingsScreen';
import { GarageScreen } from './menu/GarageScreen';

/** Menyu ichidagi ekranlar (Asphalt uslubi: bosh ekran → mashina → trassa → start) */
export type HubScreen = 'home' | 'cars' | 'race' | 'online' | 'settings' | 'garage';
/** Mashina/trassa ekranlaridan keyin nima bo'ladi: yakka poyga yoki onlayn xona yaratish */
export type Flow = 'solo' | 'online';

const TITLES: Record<HubScreen, string> = {
  home: 'Adventure Racer',
  cars: 'Mashina tanlash',
  race: 'Poyga sharoiti',
  online: 'Onlayn',
  settings: 'Sozlamalar',
  garage: 'Garaj',
};

/** Orqaga bosilganda qaytiladigan ekran */
const BACK: Record<Exclude<HubScreen, 'home' | 'garage'>, (flow: Flow) => HubScreen> = {
  cars: (flow) => (flow === 'online' ? 'online' : 'home'),
  race: () => 'cars',
  online: () => 'home',
  settings: () => 'home',
};

/** Bosh menyu: shaffof "HUD" — orqada 3D mashina shourum kamerasi bilan aylanadi */
export function Menu() {
  const [screen, setScreen] = useState<HubScreen>('home');
  const [flow, setFlow] = useState<Flow>('solo');
  const [name, setNameState] = useState(loadName);
  /** Garajga qaysi ekrandan kirilgan — orqaga shu yerga qaytiladi */
  const [garageFrom, setGarageFrom] = useState<HubScreen>('home');
  const [creditsOpen, setCreditsOpen] = useState(false);

  const setName = (v: string) => {
    setNameState(v);
    saveName(v.trim());
  };
  const back =
    screen === 'home' ? undefined : () => setScreen(screen === 'garage' ? garageFrom : BACK[screen](flow));
  const openGarage = () => {
    setGarageFrom(screen);
    setScreen('garage');
  };

  // Esc — orqaga (Mualliflar ochiq bo'lsa, uni yopish)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      if (creditsOpen) setCreditsOpen(false);
      else back?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const go = (s: HubScreen, f?: Flow) => {
    if (f) setFlow(f);
    setScreen(s);
  };

  return (
    <div className="hub">
      <TopBar title={TITLES[screen]} onBack={back} name={name} onName={setName} />
      <div className="hub-body" key={screen}>
        {screen === 'home' && (
          <HomeScreen
            go={go}
            onGarage={openGarage}
            onCredits={() => setCreditsOpen(true)}
          />
        )}
        {screen === 'cars' && (
          <CarsScreen onNext={() => setScreen('race')} onGarage={openGarage} keysEnabled={!creditsOpen} />
        )}
        {screen === 'race' && <RaceScreen flow={flow} name={name} />}
        {screen === 'online' && <OnlineScreen name={name} go={go} />}
        {screen === 'settings' && <SettingsScreen />}
        {screen === 'garage' && <GarageScreen />}
      </div>
      {creditsOpen && <Credits onClose={() => setCreditsOpen(false)} />}
    </div>
  );
}
