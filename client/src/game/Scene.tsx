import { Suspense, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import type { PerspectiveCamera } from 'three';
import { COLORS, CAMERA, LIGHTING, WORLD } from '@game/shared';
import { useQuality, QUALITY_PRESETS } from '../store/quality';
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
import { Boulders } from './track/Boulders';
import { Checkpoints } from './track/Checkpoints';
import { Coins } from './track/Coins';
import { Boosts } from './track/Boosts';
import { RaceLogic } from './track/RaceLogic';
import { RemoteCars } from './remote/RemoteCars';
import { NetSync } from './remote/NetSync';
import { EngineAudio } from '../audio/EngineAudio';
import { PerfStats } from './PerfStats';
import { WorldReady } from './WorldReady';

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

/** default export — App.tsx da lazy() bilan yuklanadi (menyu 3D dunyodan oldin chiqadi) */
export default function Scene() {
  const quality = useQuality((s) => s.quality);
  const preset = QUALITY_PRESETS[quality];
  const [minDpr, maxDpr] = preset.dpr;
  // Adaptiv piksel zichligi: FPS tushsa kamayadi, barqaror bo'lsa ko'tariladi (preset oralig'ida)
  const [dpr, setDpr] = useState(maxDpr);
  useEffect(() => setDpr(maxDpr), [maxDpr]);

  return (
    <Canvas
      // antialias faqat WebGL kontekst yaratilganda beriladi — o'zgarsa Canvas qayta yaratiladi
      key={preset.antialias ? 'aa' : 'no-aa'}
      shadows={preset.shadows}
      dpr={dpr}
      camera={{ fov: CAMERA.FOV, near: 0.1, far: preset.fogFar + 40 }}
      gl={{ antialias: preset.antialias, powerPreference: 'high-performance' }}
    >
      <PerformanceMonitor
        onChange={({ factor }) => setDpr(Math.round((minDpr + (maxDpr - minDpr) * factor) * 100) / 100)}
      />
      <CameraFar far={preset.fogFar + 40} />
      <color attach="background" args={[COLORS.sky]} />
      <fog attach="fog" args={[COLORS.fog, LIGHTING.FOG_NEAR, preset.fogFar]} />
      <Lights />
      {/* Rapier WASM asinxron yuklanadi */}
      <Suspense fallback={null}>
        <Physics gravity={[0, WORLD.GRAVITY, 0]} timeStep={1 / 60} debug={DEBUG}>
          <Terrain />
          <Scenery />
          <Bridge />
          <Tunnel />
          <Ramps />
          <Obstacles />
          <Ruins />
          <Boulders />
          <Car />
          <RemoteCars />
          <WorldReady />
        </Physics>
      </Suspense>
      <Road />
      <Checkpoints />
      <Coins />
      <Boosts />
      <RaceLogic />
      <NetSync />
      <EngineAudio />
      <PerfStats />
      <CameraRig />
    </Canvas>
  );
}
