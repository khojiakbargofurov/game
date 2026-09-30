import { CanvasTexture, DoubleSide, NearestFilter, SRGBColorSpace } from 'three';
import { COLORS, type Checkpoint } from '@game/shared';
import { useTrack } from '../../store/raceSettings';
import { useGameStore } from '../../store/gameStore';

const POLE_HEIGHT = 5;
const DIM = '#b9a58a';

/** Checkpoint darvozasi: tabiat treklarida yog'och, Tokio trekida neon-metall gantry. */
function Gate({ cp, state, city }: { cp: Checkpoint; state: 'next' | 'passed' | 'future'; city: boolean }) {
  const span = useTrack().roadHalfWidth(cp.s) + 1.3;
  const color = state === 'next' ? COLORS.checkpoint : state === 'passed' ? COLORS.checkpointPassed : DIM;
  const glow = state === 'next' ? 0.8 : 0;
  const frame = city ? '#202734' : COLORS.woodDark;
  return (
    <group position={cp.position} rotation={[0, cp.yaw, 0]}>
      {[1, -1].map((side) => (
        <group key={side}>
          <mesh position={[side * span, POLE_HEIGHT / 2, 0]} castShadow>
            {city ? <boxGeometry args={[0.48, POLE_HEIGHT, 0.48]} /> : <cylinderGeometry args={[0.18, 0.22, POLE_HEIGHT, 6]} />}
            <meshStandardMaterial color={frame} roughness={city ? 0.38 : 0.9} metalness={city ? 0.65 : 0} flatShading={!city} />
          </mesh>
          {city && (
            <mesh position={[side * (span - 0.26), POLE_HEIGHT / 2, -0.26]}>
              <boxGeometry args={[0.07, POLE_HEIGHT - 0.45, 0.035]} />
              <meshBasicMaterial color={side > 0 ? '#21ddff' : '#ff3da6'} toneMapped={false} />
            </mesh>
          )}
        </group>
      ))}
      {city && (
        <mesh position={[0, POLE_HEIGHT - 0.5, 0]} castShadow>
          <boxGeometry args={[span * 2 + 0.5, 0.78, 0.48]} />
          <meshStandardMaterial color={frame} roughness={0.38} metalness={0.65} />
        </mesh>
      )}
      <mesh position={[0, POLE_HEIGHT - 0.5, 0]} castShadow>
        <boxGeometry args={[city ? span * 1.38 : span * 2, city ? 0.52 : 0.9, city ? 0.51 : 0.12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={city ? glow + 0.35 : glow} roughness={0.32} metalness={city ? 0.35 : 0} flatShading={!city} />
      </mesh>
      {city &&
        [-0.72, -0.24, 0.24, 0.72].map((x, i) => (
          <mesh key={x} position={[x * span, POLE_HEIGHT - 0.03, -0.28]}>
            <sphereGeometry args={[0.1, 8, 6]} />
            <meshBasicMaterial color={i % 2 ? '#ff3da6' : '#21ddff'} toneMapped={false} />
          </mesh>
        ))}
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

/** Marra: baland ustunlar va shaxmat banner; Tokio trekida yoritilgan metall gantry. */
function FinishGate({ cp, city }: { cp: Checkpoint; city: boolean }) {
  const span = useTrack().roadHalfWidth(cp.s) + 1.5;
  const h = 7;
  return (
    <group position={cp.position} rotation={[0, cp.yaw, 0]}>
      {[1, -1].map((side) => (
        <group key={side}>
          <mesh position={[side * span, h / 2, 0]} castShadow>
            <boxGeometry args={[city ? 0.62 : 0.7, h, city ? 0.62 : 0.7]} />
            <meshStandardMaterial color={city ? '#202734' : COLORS.ruins} roughness={city ? 0.35 : 0.9} metalness={city ? 0.7 : 0} flatShading={!city} />
          </mesh>
          {city && (
            <mesh position={[side * (span - 0.34), h / 2, -0.34]}>
              <boxGeometry args={[0.08, h - 0.5, 0.04]} />
              <meshBasicMaterial color={side > 0 ? '#21ddff' : '#ff3da6'} toneMapped={false} />
            </mesh>
          )}
        </group>
      ))}
      {city && (
        <mesh position={[0, h - 0.8, 0.08]} castShadow>
          <boxGeometry args={[span * 2 + 0.7, 1.75, 0.58]} />
          <meshStandardMaterial color="#202734" roughness={0.35} metalness={0.7} />
        </mesh>
      )}
      <group position={[0, h - 0.8, 0]}>
        <Checkered width={city ? span * 1.55 : span * 2} depth={1.4} cols={16} rows={2} />
      </group>
      {city && (
        <>
          <mesh position={[0, h + 0.1, -0.32]}>
            <boxGeometry args={[span * 2 + 0.8, 0.1, 0.08]} />
            <meshBasicMaterial color="#21ddff" toneMapped={false} />
          </mesh>
          <mesh position={[0, h - 1.7, -0.32]}>
            <boxGeometry args={[span * 2 + 0.8, 0.1, 0.08]} />
            <meshBasicMaterial color="#ff3da6" toneMapped={false} />
          </mesh>
        </>
      )}
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
  const track = useTrack();
  const { CHECKPOINTS, LAPS } = track;
  const city = track.def.zones.some((z) => z.type === 'city');
  // Aylanali poygada darvozalar har aylanada bir xil joyda — faqat birinchi aylananikilar chiziladi,
  // holati joriy aylana bo'yicha; start/marra chizig'i — bitta shaxmat darvoza
  const perLap = CHECKPOINTS.length / LAPS;
  const current = next % perLap;
  return (
    <>
      {LAPS === 1 && <StartLine />}
      {CHECKPOINTS.filter((cp) => cp.lap === 0).map((cp, i) =>
        cp.isLapLine ? (
          <FinishGate key={cp.index} cp={cp} city={city} />
        ) : (
          <Gate key={cp.index} cp={cp} city={city} state={i === current ? 'next' : i < current ? 'passed' : 'future'} />
        ),
      )}
    </>
  );
}
