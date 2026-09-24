import { useEffect, useRef } from 'react';
import { Quaternion, Vector3 } from 'three';
import { COLORS, NET, ROUTE_STEP, type Track } from '@game/shared';
import { carTarget } from '../../game/carTarget';
import { serverNow } from '../../net/serverClock';
import { remoteBuffers } from '../../net/snapshotBuffer';
import { useGameStore } from '../../store/gameStore';
import { useNetStore } from '../../store/netStore';
import { activeTrack, useTrack } from '../../store/raceSettings';
import { useAnimationFrame } from './useAnimationFrame';

const W = 260;
const H = 118;
const PAD = 10;
const FRAME_MS = 1000 / 30;

/**
 * Xarita proyeksiyasi: marshrut shimol-janub bo'ylab cho'zilgan, shuning uchun 90° buriladi
 * (dunyo z → ekran x, dunyo -x → ekran y). Bu aylantirish — ko'zgu emas, chap/o'ng saqlanadi.
 */
function boundsOf({ ROUTE }: Track) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < ROUTE.count; i++) {
    minX = Math.min(minX, ROUTE.xs[i]);
    maxX = Math.max(maxX, ROUTE.xs[i]);
    minZ = Math.min(minZ, ROUTE.zs[i]);
    maxZ = Math.max(maxZ, ROUTE.zs[i]);
  }
  const scale = Math.min((W - PAD * 2) / (maxZ - minZ), (H - PAD * 2) / (maxX - minX));
  // Markazlash
  const offX = (W - (maxZ - minZ) * scale) / 2;
  const offY = (H - (maxX - minX) * scale) / 2;
  return { minZ, maxX, scale, offX, offY };
}

let bounds = boundsOf(activeTrack());

const toMap = (x: number, z: number): [number, number] => [
  bounds.offX + (z - bounds.minZ) * bounds.scale,
  bounds.offY + (bounds.maxX - x) * bounds.scale,
];

const ZONE_COLOR = { forest: '#7fae4f', canyon: COLORS.canyonA, ruins: '#d9c08a', circuit: '#cfd2d8' } as const;

/** Statik fon: marshrut (zona ranglarida), ko'prik, tunnel, checkpointlar, marra */
function drawBackground(ctx: CanvasRenderingContext2D, { ROUTE, BRIDGE, TUNNEL, LAKE, CHECKPOINTS, zoneAt }: Track) {
  // Ko'l
  if (LAKE) {
    const [x, y] = toMap(LAKE.x, LAKE.z);
    ctx.fillStyle = 'rgba(79, 159, 179, 0.55)';
    ctx.beginPath();
    ctx.arc(x, y, (LAKE.radius - 15) * bounds.scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = (from: number, to: number) => {
    ctx.beginPath();
    for (let i = from; i <= to; i++) {
      const [x, y] = toMap(ROUTE.xs[i], ROUTE.zs[i]);
      if (i === from) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  // Kontur
  ctx.strokeStyle = 'rgba(30, 18, 10, 0.55)';
  ctx.lineWidth = 7;
  path(0, ROUTE.count - 1);
  // Zonalar bo'yicha rang
  ctx.lineWidth = 4;
  let start = 0;
  for (let i = 1; i < ROUTE.count; i++) {
    const zoneChanged = zoneAt(i * ROUTE_STEP) !== zoneAt(start * ROUTE_STEP);
    if (zoneChanged || i === ROUTE.count - 1) {
      ctx.strokeStyle = ZONE_COLOR[zoneAt(start * ROUTE_STEP)];
      path(start, i);
      start = i;
    }
  }
  // Ko'prik (daryo ustida) va tunnel
  if (BRIDGE) {
    ctx.strokeStyle = COLORS.water;
    path(Math.round(BRIDGE.start / ROUTE_STEP), Math.round(BRIDGE.end / ROUTE_STEP));
  }
  if (TUNNEL) {
    ctx.strokeStyle = '#3a2a22';
    path(Math.round(TUNNEL.start / ROUTE_STEP), Math.round(TUNNEL.end / ROUTE_STEP));
  }

  // Checkpointlar
  for (const cp of CHECKPOINTS) {
    const [x, y] = toMap(cp.position[0], cp.position[2]);
    if (cp.isFinish) {
      ctx.font = '12px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏁', x, y - 1);
    } else {
      ctx.fillStyle = '#fff5e6';
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
  }
}

const pos = new Vector3();
const quat = new Quaternion();
const fwd = new Vector3();

/** Butun trassa yuqoridan: barcha o'yinchilar rangli nuqta, o'zimiz — yo'nalish uchburchagi */
export function Minimap() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const background = useRef<HTMLCanvasElement | null>(null);
  const lastDraw = useRef(0);
  const track = useTrack();

  useEffect(() => {
    bounds = boundsOf(track);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = canvas.current!;
    c.width = W * dpr;
    c.height = H * dpr;
    const bg = document.createElement('canvas');
    bg.width = W * dpr;
    bg.height = H * dpr;
    const bctx = bg.getContext('2d')!;
    bctx.scale(dpr, dpr);
    drawBackground(bctx, track);
    background.current = bg;
  }, [track]);

  useAnimationFrame((now) => {
    const c = canvas.current;
    const bg = background.current;
    if (!c || !bg || now - lastDraw.current < FRAME_MS) return;
    lastDraw.current = now;
    const ctx = c.getContext('2d')!;
    const dpr = c.width / W;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(bg, 0, 0);
    ctx.scale(dpr, dpr);

    // Navbatdagi checkpoint — pulsatsiyalanuvchi halqa
    const cp = activeTrack().CHECKPOINTS[useGameStore.getState().nextCheckpoint];
    if (cp) {
      const [x, y] = toMap(cp.position[0], cp.position[2]);
      ctx.strokeStyle = COLORS.checkpoint;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 4 + Math.sin(now / 150) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Boshqa o'yinchilar
    const { room, selfId, mode } = useNetStore.getState();
    if (mode === 'online' && room) {
      const renderT = serverNow() - NET.INTERP_DELAY_MS;
      for (const p of room.players) {
        if (p.id === selfId) continue;
        if (!remoteBuffers.get(p.id)?.sample(renderT, pos, quat)) continue;
        const [x, y] = toMap(pos.x, pos.z);
        ctx.fillStyle = p.color;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // O'zimiz: yo'nalish uchburchagi (xarita 90° burilgan: dunyo (x, z) → ekran (z, -x))
    const [x, y] = toMap(carTarget.position.x, carTarget.position.z);
    fwd.set(0, 0, 1).applyQuaternion(carTarget.quaternion);
    const a = Math.atan2(-fwd.x, fwd.z);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e0572b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, 4);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-4, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });

  return <canvas ref={canvas} className="minimap" style={{ width: W, height: H }} />;
}
