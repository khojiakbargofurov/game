import { useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { BufferAttribute, BufferGeometry, Color, DoubleSide } from 'three';
import { COLORS, createRng, yawOf, type Track, type TunnelDef } from '@game/shared';
import { usePalette, useTrack } from '../../store/raceSettings';

const STEP = 3; // kesimlar orasidagi masofa (m)
const ARC_SEGMENTS = 7; // yarim aylana bo'laklari (low-poly)
const THICKNESS = 3;
const WALL_SEGMENT = 6;

/**
 * Yo'l bo'ylab cho'zilgan arka (yarim ellips kesim) — ichki va tashqi sirt + kirish/chiqish halqalari.
 * Tashqi sirt tasodifiy "bo'rtiq"li — qoya/g'or ko'rinishi uchun.
 */
function buildShell({ roadHalfWidth, routeAt }: Track, TUNNEL: TunnelDef, rockColor: string) {
  const rng = createRng(4242);
  const rings: { inner: number[][]; outer: number[][] }[] = [];
  for (let s = TUNNEL.start; s <= TUNNEL.end + 0.01; s += STEP) {
    const f = routeAt(s);
    const r = roadHalfWidth(s) + 1.6;
    const lx = f.tz;
    const lz = -f.tx;
    const inner: number[][] = [];
    const outer: number[][] = [];
    for (let k = 0; k <= ARC_SEGMENTS; k++) {
      const a = (k / ARC_SEGMENTS) * Math.PI; // 0 = chap, π = o'ng
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const ro = r + THICKNESS + (rng() - 0.3) * 1.6;
      inner.push([f.x + lx * cos * r, f.y - 0.3 + sin * TUNNEL.height, f.z + lz * cos * r]);
      outer.push([f.x + lx * cos * ro, f.y - 0.6 + sin * (TUNNEL.height + THICKNESS), f.z + lz * cos * ro]);
    }
    rings.push({ inner, outer });
  }

  const pos: number[] = [];
  const col: number[] = [];
  const dark = new Color('#4a3b33');
  const rock = new Color(rockColor);
  const tri = (a: number[], b: number[], c: number[], color: Color) => {
    pos.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) col.push(color.r, color.g, color.b);
  };
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i];
    const B = rings[i + 1];
    for (let k = 0; k < ARC_SEGMENTS; k++) {
      // Ichki sirt (normal ichkariga)
      tri(A.inner[k], B.inner[k], A.inner[k + 1], dark);
      tri(A.inner[k + 1], B.inner[k], B.inner[k + 1], dark);
      // Tashqi sirt (normal tashqariga)
      tri(A.outer[k], A.outer[k + 1], B.outer[k], rock);
      tri(A.outer[k + 1], B.outer[k + 1], B.outer[k], rock);
    }
  }
  // Kirish va chiqish: ichki va tashqi yoy orasini yopish
  for (const [ring, flip] of [
    [rings[0], false],
    [rings[rings.length - 1], true],
  ] as const) {
    for (let k = 0; k < ARC_SEGMENTS; k++) {
      const a = ring.inner[k];
      const b = ring.inner[k + 1];
      const c = ring.outer[k];
      const d = ring.outer[k + 1];
      if (flip) {
        tri(a, b, c, rock);
        tri(b, d, c, rock);
      } else {
        tri(a, c, b, rock);
        tri(b, c, d, rock);
      }
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Kanyondagi g'or-tunnel. Fizika: yo'l chetlarida devor colliderlari (tom collideri shart emas).
 * Ichkarida yorug' kristallar — sarguzasht muhiti uchun.
 */
/** Trassada tunnel bo'lmasa — hech narsa chizilmaydi */
export function Tunnel() {
  const track = useTrack();
  return track.TUNNEL ? <TunnelImpl track={track} tunnel={track.TUNNEL} /> : null;
}

function TunnelImpl({ track, tunnel: TUNNEL }: { track: Track; tunnel: TunnelDef }) {
  const { roadHalfWidth, routeAt } = track;
  const palette = usePalette();
  // Alp tunneli — kulrang granit, kanyondagisi — qizil qoya
  const rockColor = track.zoneAt(TUNNEL.start) === 'alpine' ? palette.alpineRockDark : palette.canyonB;
  const { shell, walls, crystals } = useMemo(() => {
    const walls: { position: [number, number, number]; yaw: number }[] = [];
    for (let s = TUNNEL.start; s < TUNNEL.end; s += WALL_SEGMENT) {
      const f = routeAt(s + WALL_SEGMENT / 2);
      const off = roadHalfWidth(s) + 1.4;
      for (const side of [1, -1]) {
        walls.push({
          position: [f.x + f.tz * off * side, f.y + 2.5, f.z - f.tx * off * side],
          yaw: yawOf(f.tx, f.tz),
        });
      }
    }
    const crystals: { position: [number, number, number]; color: string }[] = [];
    let side = 1;
    for (let s = TUNNEL.start + 6; s < TUNNEL.end - 3; s += 9, side = -side) {
      const f = routeAt(s);
      const off = (roadHalfWidth(s) + 1.1) * side;
      crystals.push({
        position: [f.x + f.tz * off, f.y + 1.6, f.z - f.tx * off],
        color: side > 0 ? COLORS.crystal : '#c47bff',
      });
    }
    return { shell: buildShell(track, TUNNEL, rockColor), walls, crystals };
  }, [track, TUNNEL, roadHalfWidth, routeAt, rockColor]);

  return (
    <group>
      <mesh geometry={shell} castShadow receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={1} side={DoubleSide} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        {walls.map((w, i) => (
          <CuboidCollider key={i} args={[0.5, 3, WALL_SEGMENT / 2 + 0.2]} position={w.position} rotation={[0, w.yaw, 0]} />
        ))}
      </RigidBody>
      {crystals.map((c, i) => (
        <mesh key={i} position={c.position} rotation={[0.3, i, 0.4]} scale={[0.35, 0.8, 0.35]}>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={c.color} emissive={c.color} emissiveIntensity={1.4} flatShading />
        </mesh>
      ))}
    </group>
  );
}
