import { CanvasTexture, DoubleSide, NearestFilter, SRGBColorSpace } from 'three';
import { COLORS, type Checkpoint } from '@game/shared';
import { useTrack } from '../../store/raceSettings';
import { useGameStore } from '../../store/gameStore';

const POLE_HEIGHT = 5;
const DIM = '#b9a58a';

/** Oddiy checkpoint darvozasi: ikki ustun + banner. Keyingi checkpoint yorqin rangda */
function Gate({ cp, state }: { cp: Checkpoint; state: 'next' | 'passed' | 'future' }) {
  const span = useTrack().roadHalfWidth(cp.s) + 1.3;
  const color = state === 'next' ? COLORS.checkpoint : state === 'passed' ? COLORS.checkpointPassed : DIM;
  const glow = state === 'next' ? 0.8 : 0;
  return (
    <group position={cp.position} rotation={[0, cp.yaw, 0]}>
      {[1, -1].map((side) => (
        <mesh key={side} position={[side * span, POLE_HEIGHT / 2, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.22, POLE_HEIGHT, 6]} />
          <meshStandardMaterial color={COLORS.woodDark} flatShading />
        </mesh>
      ))}
      <mesh position={[0, POLE_HEIGHT - 0.5, 0]} castShadow>
        <boxGeometry args={[span * 2, 0.9, 0.12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} flatShading />
      </mesh>
      {/* Yerdagi chiziq */}
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[span * 2 - 2.4, 0.02, 0.5]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow * 0.6} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

const checkerCache = new Map<string, CanvasTexture>();

/** Shaxmat tekstura (kodda generatsiya qilinadi, tashqi fayl yo'q) — bir xil o'lcham qayta ishlatiladi */
function checkerTexture(cols: number, rows: number): CanvasTexture {
  const key = `${cols}x${rows}`;
  let tex = checkerCache.get(key);
  if (!tex) {
    const canvas = document.createElement('canvas');
    canvas.width = cols * 8;
    canvas.height = rows * 8;
    const ctx = canvas.getContext('2d')!;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 ? '#222' : '#f5f1e8';
        ctx.fillRect(c * 8, r * 8, 8, 8);
      }
    }
    tex = new CanvasTexture(canvas);
    tex.magFilter = NearestFilter; // keskin kataklar
    tex.colorSpace = SRGBColorSpace;
    checkerCache.set(key, tex);
  }
  return tex;
}

/** Shaxmat katakli yuza — bitta mesh (lokal XY tekisligida) */
function Checkered({ width, depth, cols, rows }: { width: number; depth: number; cols: number; rows: number }) {
  return (
    <mesh>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial map={checkerTexture(cols, rows)} side={DoubleSide} />
    </mesh>
  );
}

/** Marra: baland ustunlar va shaxmat banner, yo'lda shaxmat chiziq */
function FinishGate({ cp }: { cp: Checkpoint }) {
  const span = useTrack().roadHalfWidth(cp.s) + 1.5;
  const h = 7;
  return (
    <group position={cp.position} rotation={[0, cp.yaw, 0]}>
      {[1, -1].map((side) => (
        <mesh key={side} position={[side * span, h / 2, 0]} castShadow>
          <boxGeometry args={[0.7, h, 0.7]} />
          <meshStandardMaterial color={COLORS.ruins} flatShading />
        </mesh>
      ))}
      <group position={[0, h - 0.8, 0]}>
        <Checkered width={span * 2} depth={1.4} cols={16} rows={2} />
      </group>
      <group position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <Checkered width={span * 2 - 1} depth={1.6} cols={14} rows={2} />
      </group>
    </group>
  );
}

/** Start chizig'i */
function StartLine() {
  const { trackPoint, roadHalfWidth } = useTrack();
  const p = trackPoint(20);
  const span = roadHalfWidth(20);
  return (
    <group position={p.position} rotation={[0, p.yaw, 0]}>
      <group position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <Checkered width={span * 2} depth={1.2} cols={14} rows={2} />
      </group>
    </group>
  );
}

export function Checkpoints() {
  const next = useGameStore((s) => s.nextCheckpoint);
  const { CHECKPOINTS } = useTrack();
  return (
    <>
      <StartLine />
      {CHECKPOINTS.map((cp) =>
        cp.isFinish ? (
          <FinishGate key={cp.index} cp={cp} />
        ) : (
          <Gate key={cp.index} cp={cp} state={cp.index === next ? 'next' : cp.index < next ? 'passed' : 'future'} />
        ),
      )}
    </>
  );
}
