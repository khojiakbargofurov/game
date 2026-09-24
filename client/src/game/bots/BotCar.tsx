import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useBeforePhysicsStep, type RapierRigidBody } from '@react-three/rapier';
import type { Group } from 'three';
import { BOOST_RADIUS, BOOST_RESPAWN_MS, CAR, WEATHER_FX, carStats, type SpawnPoint } from '@game/shared';
import { useGameStore } from '../../store/gameStore';
import { useNetStore } from '../../store/netStore';
import { activeSettings, activeTrack } from '../../store/raceSettings';
import { pickups } from '../../store/pickups';
import { SELF_ID, botRuntime, raceProgress, useBots, type BotInfo } from '../../store/bots';
import { carTarget } from '../carTarget';
import { Chassis, boostKick, fellOffTrack, forwardSpeed, syncWheels, teleport, uprightness, yawOfBody } from '../car/chassis';
import { useCarModel } from '../car/carGeometry';
import { computeDrive, type DriveInput } from '../car/driveLogic';
import { useVehicleController } from '../car/useVehicleController';
import { applyDriveCommand } from '../car/vehicleSetup';
import { NameTag } from '../remote/NameTag';
import { botDrive } from './botDriver';

const IDLE: DriveInput = { forward: false, backward: false, left: false, right: false, handbrake: false };
const BOOST_R2 = BOOST_RADIUS * BOOST_RADIUS;
/** Rubber-band: o'yinchidan shuncha metr oldinda/ortda bo'lsa — tezlik ±PACE */
const PACE_RANGE = 150;
const PACE = 0.05;

/** Har bot uchun "boshqa mashinalar" ro'yxati (qayta ishlatiladigan massiv) */
type Other = { x: number; z: number; speed: number };

function collectOthers(selfId: string, out: Other[]) {
  out.length = 0;
  out.push({ x: carTarget.position.x, z: carTarget.position.z, speed: carTarget.speed });
  for (const [id, rt] of botRuntime) if (id !== selfId) out.push({ x: rt.position.x, z: rt.position.z, speed: rt.speed });
  return out;
}

const racing = () => {
  const phase = useGameStore.getState().phase;
  return useNetStore.getState().screen === 'race' && (phase === 'racing' || phase === 'finished');
};

/**
 * Bot mashinasi: o'yinchinikiga o'xshash haqiqiy fizika (to'qnashadi), boshqaruv — botDriver.
 * Checkpoint va boost kristallarini o'zi oladi (tangalarni emas).
 */
function BotCar({ info }: { info: BotInfo }) {
  const { wheelX, wheelDrop } = useCarModel(info.car);
  const body = useRef<RapierRigidBody>(null);
  const wheels = useRef<(Group | null)[]>([]);
  const { controller, ensure } = useVehicleController();
  const steer = useRef(0);
  const flipTime = useRef(0);
  const lastBoost = useRef(0);
  const others = useRef<Other[]>([]);
  const [initial] = useState<SpawnPoint>(() => activeTrack().gridSpawn(info.slot));

  useBeforePhysicsStep((world) => {
    const rb = body.current;
    const v = ensure(rb);
    const rt = botRuntime.get(info.id);
    if (!rb || !v || !rt) return;
    const dt = world.timestep;
    const speed = forwardSpeed(rb);
    const game = useGameStore.getState();
    const track = activeTrack();

    // Countdown boshlanganda — start joyiga aniq qo'yish (dunyo endi tayyor)
    if (game.phase === 'countdown' && !rt.placed) {
      teleport(rb, rt.respawnPoint);
      rt.placed = true;
    }

    const flipped = uprightness(rb) < 0.3 && Math.abs(speed) < 3;
    flipTime.current = flipped ? flipTime.current + dt : 0;
    let respawn = fellOffTrack(rb) || flipTime.current * 1000 > CAR.FLIP_RESPAWN_DELAY_MS;

    const grip = WEATHER_FX[activeSettings().weather].grip;
    const stats = carStats(info.levels, grip);
    let input = IDLE;
    if (racing() && rt.finishMs === null) {
      // Rubber-band: o'yinchidan juda oldinda — biroz sekinroq, ortda — tezroq
      const p = rb.translation();
      const gap =
        raceProgress(track, rt.nextCheckpoint, p.x, p.z) -
        raceProgress(track, game.nextCheckpoint, carTarget.position.x, carTarget.position.z);
      const pace = game.phase === 'finished' ? 1 : 1 - Math.max(-1, Math.min(1, gap / PACE_RANGE)) * PACE;
      const out = botDrive(rt.driver, {
        track,
        x: p.x,
        y: p.y,
        z: p.z,
        yaw: yawOfBody(rb),
        speed,
        dt,
        skill: info.skill,
        lane: info.lane,
        maxSpeed: stats.maxSpeed,
        grip,
        pace,
        others: collectOthers(info.id, others.current),
      });
      input = out.input;
      respawn ||= out.respawn;
    }
    if (respawn) {
      teleport(rb, rt.respawnPoint);
      steer.current = 0;
      flipTime.current = 0;
    }

    const boosting = performance.now() < rt.boostUntil;
    if (rt.boostUntil !== lastBoost.current) {
      lastBoost.current = rt.boostUntil;
      if (boosting) boostKick(rb);
    }
    const cmd = computeDrive(steer.current, input, speed, dt, boosting ? CAR.BOOST_MULTIPLIER : 1, stats);
    steer.current = cmd.steer;
    applyDriveCommand(v, cmd, stats);
    v.updateVehicle(dt);
  });

  useFrame(() => {
    const v = controller.current;
    const rb = body.current;
    const rt = botRuntime.get(info.id);
    if (!v || !rb || !rt) return;
    syncWheels(v, wheels.current, wheelX, wheelDrop);
    const p = rb.translation();
    const r = rb.rotation();
    rt.position.set(p.x, p.y, p.z);
    rt.quaternion.set(r.x, r.y, r.z, r.w);
    rt.speed = forwardSpeed(rb);

    const game = useGameStore.getState();
    if (!racing() || rt.finishMs !== null || game.startedAt === null) return;
    const now = performance.now();
    const { CHECKPOINTS, BOOSTS } = activeTrack();

    // Checkpoint: o'yinchidagi kabi — faqat navbatdagisi, gorizontal radius ichida
    const cp = CHECKPOINTS[rt.nextCheckpoint];
    if (cp) {
      const dx = cp.position[0] - p.x;
      const dz = cp.position[2] - p.z;
      if (dx * dx + dz * dz < cp.radius * cp.radius && Math.abs(cp.position[1] - p.y) < 8) {
        rt.nextCheckpoint = cp.index + 1;
        rt.respawnPoint = { position: [cp.position[0], cp.position[1] + 1.2, cp.position[2]], yaw: cp.yaw };
        if (cp.isFinish) rt.finishMs = now - game.startedAt;
      }
    }

    // Boost-kristallar (o'yinchi bilan umumiy — bot olsa, o'yinchi uchun ham vaqtincha yo'qoladi)
    for (let i = 0; i < BOOSTS.length; i++) {
      const taken = pickups.boostTakenAt[i];
      if (taken && now - taken < BOOST_RESPAWN_MS) continue;
      const b = BOOSTS[i].position;
      if ((b[0] - p.x) ** 2 + (b[1] - p.y) ** 2 + (b[2] - p.z) ** 2 < BOOST_R2) {
        pickups.boostTakenAt[i] = now;
        rt.boostUntil = now + carStats(info.levels).boostDurationMs;
      }
    }
  });

  return (
    <Chassis body={body} wheels={wheels} car={info.car} look={info.look} initial={initial}>
      <NameTag name={info.name} color={info.color} />
    </Chassis>
  );
}

const STANDINGS_MS = 200;

/** O'rinlarni ~5 Hz hisoblash: marraga yetganlar vaqt bo'yicha, qolganlar yo'l bo'yicha */
function BotStandings() {
  const last = useRef(0);
  useFrame(() => {
    const now = performance.now();
    if (now - last.current < STANDINGS_MS) return;
    last.current = now;
    const { bots, standings } = useBots.getState();
    if (!bots.length || useNetStore.getState().screen !== 'race') return;
    const game = useGameStore.getState();
    const track = activeTrack();
    const selfFinish = game.finishedAt !== null && game.startedAt !== null ? game.finishedAt - game.startedAt : null;
    const rows = [
      {
        id: SELF_ID,
        finish: selfFinish,
        progress: raceProgress(track, game.nextCheckpoint, carTarget.position.x, carTarget.position.z),
      },
      ...bots.map((b) => {
        const rt = botRuntime.get(b.id)!;
        return { id: b.id, finish: rt.finishMs, progress: raceProgress(track, rt.nextCheckpoint, rt.position.x, rt.position.z) };
      }),
    ];
    rows.sort((a, b) =>
      a.finish !== null || b.finish !== null
        ? (a.finish ?? Infinity) - (b.finish ?? Infinity)
        : b.progress - a.progress,
    );
    const order = rows.map((r) => r.id);
    if (order.some((id, i) => standings[i] !== id)) useBots.setState({ standings: order });
  });
  return null;
}

/** Yakka rejimdagi barcha botlar (fizika ichida) */
export function Bots() {
  const bots = useBots((s) => s.bots);
  const raceId = useBots((s) => s.raceId);
  return (
    <>
      {bots.map((b) => (
        <BotCar key={`${raceId}-${b.id}`} info={b} />
      ))}
      <BotStandings />
    </>
  );
}
