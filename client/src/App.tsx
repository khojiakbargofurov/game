import { lazy, Suspense } from 'react';
import { useNetStore } from './store/netStore';
import { useLoadState } from './store/loadState';
import { Hud } from './ui/hud/Hud';
import { FinishOverlay } from './ui/FinishOverlay';
import { Menu } from './ui/Menu';
import { RoomLobby } from './ui/RoomLobby';
import { Countdown } from './ui/Countdown';
import './net/session';
import './audio/gameSounds';

// 3D dunyo (three.js + Rapier) alohida chunk — menyu undan oldin ko'rinadi
const Scene = lazy(() => import('./game/Scene'));

export default function App() {
  const screen = useNetStore((s) => s.screen);
  const worldReady = useLoadState((s) => s.worldReady);
  return (
    <>
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
      {!worldReady && <div className={screen === 'race' ? 'loading big' : 'loading'}>3D dunyo yuklanmoqda…</div>}
      {screen === 'menu' && <Menu />}
      {screen === 'room' && <RoomLobby />}
      {screen === 'race' && (
        <>
          <Hud />
          <Countdown />
          <FinishOverlay />
        </>
      )}
    </>
  );
}
