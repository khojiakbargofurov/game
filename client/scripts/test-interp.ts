/**
 * SnapshotBuffer testlari: interpolyatsiya, ekstrapolyatsiya chegarasi, eskirgan paketlar, respawn sakrashi.
 *   npm run test:interp -w client
 */
import { Quaternion, Vector3 } from 'three';
import { NET, type PlayerState } from '@game/shared';
import { SnapshotBuffer } from '../src/net/snapshotBuffer';

let failures = 0;
const check = (cond: boolean, label: string) => {
  console.log(`${cond ? '✅' : '❌'} ${label}`);
  if (!cond) failures++;
};
const near = (a: number, b: number, eps = 1e-3) => Math.abs(a - b) < eps;

const yawQ = (yaw: number): PlayerState['rotation'] => [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
const state = (z: number, yaw = 0, vz = 20): PlayerState => ({
  id: 'x',
  position: [0, 1, z],
  rotation: yawQ(yaw),
  velocity: [0, 0, vz],
});

const b = new SnapshotBuffer();
const p = new Vector3();
const q = new Quaternion();
const TICK = 1000 / NET.TICK_RATE; // 50 ms

check(!b.sample(0, p, q), "bo'sh bufer — namuna yo'q");

// 20 m/s: har 50 ms da 1 m
for (let i = 0; i <= 10; i++) b.push(1000 + i * TICK, state(i, i * 0.1));

b.sample(1000 + 2.5 * TICK, p, q);
check(near(p.z, 2.5), `ikki snapshot o'rtasida lerp (z=${p.z.toFixed(3)}, kutilgan 2.5)`);

const expectedYaw = 0.25;
const yaw = 2 * Math.atan2(q.y, q.w);
check(near(yaw, expectedYaw), `aylanish slerp (yaw=${yaw.toFixed(3)}, kutilgan ${expectedYaw})`);

b.sample(500, p, q);
check(near(p.z, 0), 'bufer boshidan oldingi vaqt — birinchi snapshot');

b.sample(1000 + 10 * TICK + 100, p, q);
check(near(p.z, 12), `oxirgidan 100 ms keyin — tezlik bo'yicha ekstrapolyatsiya (z=${p.z.toFixed(2)}, kutilgan 12)`);

b.sample(1000 + 10 * TICK + 5000, p, q);
check(near(p.z, 14), `ekstrapolyatsiya 200 ms bilan cheklangan (z=${p.z.toFixed(2)}, kutilgan 14)`);

b.push(1000 + 5 * TICK, state(999));
b.sample(1000 + 5 * TICK, p, q);
check(near(p.z, 5), 'eskirgan (tartibsiz) paket e`tiborsiz qoldirildi');

// Respawn: 300 m sakrash — interpolyatsiya qilinmaydi
const r = new SnapshotBuffer();
r.push(0, state(0));
r.push(TICK, state(300));
r.sample(TICK / 2, p, q);
check(near(p.z, 300), 'katta sakrash (respawn) — silliqlanmasdan yangi joyga');

// Bufer hajmi cheklangan
const big = new SnapshotBuffer();
for (let i = 0; i < NET.SNAPSHOT_BUFFER_SIZE + 20; i++) big.push(i * TICK, state(i));
big.sample(0, p, q);
check(near(p.z, 20), `bufer ${NET.SNAPSHOT_BUFFER_SIZE} ta snapshot bilan cheklangan (eng eskisi z=${p.z})`);

console.log(failures ? `\n${failures} ta test muvaffaqiyatsiz` : '\nBarcha testlar o`tdi');
process.exit(failures ? 1 : 0);
