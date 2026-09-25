import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { Color, type PerspectiveCamera } from 'three';
import { CAMERA, LIGHTING, WORLD, getTrack } from '@game/shared';
import { useQuality, QUALITY_PRESETS } from '../store/quality';
import { useActiveSettings, usePalette, useWeatherFx } from '../store/raceSettings';
import { Lights } from './Lights';
import { Terrain } from './Terrain';
import { Scenery } from './scenery/Scenery';
import { Car } from './car/Car';
import { CameraRig } from './CameraRig';
import { Road } from './track/Road';
import { Bridge } from './track/Bridge';
import { Tunnel } from './track/Tunnel';
import { Ramps } from './track/Ramps';
import { Obstacles } from './track/Obstacles';
import { Ruins } from './track/Ruins';
import { KitTrack } from './track/KitTrack';
import { Boulders } from './track/Boulders';
import { Checkpoints } from './track/Checkpoints';
import { Coins } from './track/Coins';
import { Boosts } from './track/Boosts';
import { RaceLogic } from './track/RaceLogic';
import { RemoteCars } from './remote/RemoteCars';
import { Bots } from './bots/BotCar';
import { NetSync } from './remote/NetSync';
import { EngineAudio } from '../audio/EngineAudio';
import { PerfStats } from './PerfStats';
import { WorldReady } from './WorldReady';
import { Weather } from './Weather';
import { Skyline } from './Skyline';
import { Guardrail } from './track/Guardrail';
import { City } from './track/City';
import { initCarEnv } from './car/carEnv';

/** URL'da ?debug bo'lsa fizika colliderlari ko'rsatiladi */
const DEBUG = new URLSearchParams(location.search).has('debug');

/** Tuman ortidagi narsalar baribir ko'rinmaydi — kamera uzoqligi tumanga moslanadi (culling) */
function CameraFar({ far }: { far: number }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useEffect(() => {
    camera.far = far;
    camera.updateProjectionMatrix();
  }, [camera, far]);
  return null;
}

/** Mashinalar uchun atrof-muhit aksini renderer tayyor bo'lganda yasash (carEnv.ts) */
function CarEnv() {
  const gl = useThree((s) => s.gl);
  useEffect(() => initCarEnv(gl), [gl]);
  return null;
}

/** Tungi trassa osmoni va tumani */
const NIGHT = { sky: '#0a0f26', fog: '#141a3a' } as const;

/** default export — App.tsx da lazy() bilan yuklanadi (menyu 3D dunyodan oldin chiqadi) */
export default function Scene() {
  const quality = useQuality((s) => s.quality);
  const preset = QUALITY_PRESETS[quality];
  const [minDpr, maxDpr] = preset.dpr;
  // Adaptiv piksel zichligi: FPS tushsa kamayadi, barqaror bo'lsa ko'tariladi (preset oralig'ida)
  const [dpr, setDpr] = useState(maxDpr);
  useEffect(() => setDpr(maxDpr), [maxDpr]);

  // Fasl + ob-havo: osmon/tuman rangi ob-havo rangiga aralashtiriladi, yomg'ir/qorda tuman yaqinroq
  const { trackId, season } = useActiveSettings();
  const env = getTrack(trackId).def.env;
  const palette = usePalette();
  const fx = useWeatherFx();
  const night = !!env?.night;
  const { sky, fog } = useMemo(() => {
    // Tunda — to'q ko'k-binafsha osmon; ob-havo rangi ozroq aralashadi (yomg'irli tun ham qorong'i qolsin)
    const tintAmount = night ? fx.tintAmount * 0.2 : fx.tintAmount;
    const mix = (c: string) => (fx.tint ? new Color(c).lerp(new Color(fx.tint), tintAmount) : new Color(c));
    return night ? { sky: mix(NIGHT.sky), fog: mix(NIGHT.fog) } : { sky: mix(palette.sky), fog: mix(palette.fog) };
  }, [palette, fx, night]);
  const fogFar = preset.fogFar * fx.fogScale;

  return (
    <Canvas
      // antialias faqat WebGL kontekst yaratilganda beriladi — o'zgarsa Canvas qayta yaratiladi
      key={preset.antialias ? 'aa' : 'no-aa'}
      shadows={preset.shadows}
      dpr={dpr}
      camera={{ fov: CAMERA.FOV, near: 0.1, far: fogFar + 40 }}
      gl={{ antialias: preset.antialias, powerPreference: 'high-performance' }}
    >
      <PerformanceMonitor
        onChange={({ factor }) => setDpr(Math.round((minDpr + (maxDpr - minDpr) * factor) * 100) / 100)}
      />
      <CameraFar far={fogFar + 40} />
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[fog, LIGHTING.FOG_NEAR * fx.fogScale, fogFar]} />
      <Lights />
      <CarEnv />
      {/* Rapier WASM asinxron yuklanadi */}
      <Suspense fallback={null}>
        {/* key — trassa yoki fasl o'zgarsa butun dunyo (relyef, colliderlar) qaytadan quriladi */}
        <Physics key={`${trackId}-${season}`} gravity={[0, WORLD.GRAVITY, 0]} timeStep={1 / 60} debug={DEBUG}>
          <Terrain />
          <Scenery />
          <Bridge />
          <Tunnel />
          <Ramps />
          <Obstacles />
          <Ruins />
          <KitTrack />
          <Boulders />
          <Guardrail />
          <City />
          {/* Mashinalar o'z Suspense'ida: model yuklanayotganda dunyo yashirilmaydi */}
          <Suspense fallback={null}>
            <Car />
          </Suspense>
          <RemoteCars />
          <Bots />
          <WorldReady />
        </Physics>
      </Suspense>
      <Road />
      {env?.skyline && <Skyline kind={env.skyline} fog={fog} />}
      <Checkpoints />
      <Coins />
      <Boosts />
      <Weather />
      <RaceLogic />
      <NetSync />
      <EngineAudio />
      <PerfStats />
      <CameraRig />
    </Canvas>
  );
}
