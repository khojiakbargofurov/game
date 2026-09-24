/**
 * Barcha o'yin konstantalari shu yerda. Client ham, server ham shu fayldan o'qiydi.
 * Qiymatlar keyingi bosqichlarda sozlanadi.
 */

export const NET = {
  /** Server snapshot tarqatish va klient holat yuborish chastotasi (Hz) */
  TICK_RATE: 20,
  /** Boshqa o'yinchilarni ko'rsatishdagi interpolyatsiya kechikishi (ms) */
  INTERP_DELAY_MS: 100,
  /** Snapshot buferida saqlanadigan maksimal snapshotlar soni */
  SNAPSHOT_BUFFER_SIZE: 30,
  DEFAULT_PORT: 3001,
} as const;

export const ROOM = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 8,
  CODE_LENGTH: 6,
  /** Xona kodi uchun belgilar (chalkash O/0, I/1 olib tashlangan) */
  CODE_ALPHABET: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  NAME_MAX_LENGTH: 16,
  /** Har bir o'yinchiga slot bo'yicha beriladigan mashina rangi */
  PLAYER_COLORS: ['#e0572b', '#2b8fe0', '#3fb24f', '#e0c02b', '#a24fe0', '#e04f9b', '#2bd1c4', '#f2f2f2'],
  COUNTDOWN_SECONDS: 3,
} as const;

/**
 * Tanlanadigan mashinalar (client/public/model/). Fizika hammasida bir xil — farq faqat ko'rinishda.
 * `color` — menyudagi namuna rangi (modeldagi korpus rangi).
 * `realWheels` — g'ildiraklar modeldagi asl proporsiyada (sport mashina: kichik g'ildirak), korpus shunga
 * mos pastroq tushiriladi; aks holda (Kenney baggilari) vizual g'ildirak radiusi = CAR.WHEEL_RADIUS.
 */
export const CARS: readonly CarDef[] = [
  { id: 'red', label: 'Qizil', model: 'raceCarRed.glb', color: '#e85454' },
  { id: 'green', label: 'Yashil', model: 'raceCarGreen.glb', color: '#4d8f6e' },
  { id: 'orange', label: "To'q sariq", model: 'raceCarOrange.glb', color: '#f5ba42' },
  { id: 'white', label: 'Oq', model: 'raceCarWhite.glb', color: '#f2f2f4' },
  { id: 'super', label: 'Superkar', model: 'superCar.glb', color: '#f5b400', realWheels: true, icon: 'sport', fixedRims: true },
  // Sketchfab modellari — scripts/import-car.ts bilan o'yin formatiga o'tkazilgan (teksturali, asl g'ildiraklar)
  { id: 'rally', label: 'Rally', model: 'rally.glb', color: '#e8e8ec', realWheels: true, icon: 'sedan', fixedRims: true },
  { id: 'sport', label: 'Sport', model: 'sport.glb', color: '#c93a3a', realWheels: true, icon: 'sport', fixedRims: true },
  { id: 'coupe', label: 'Kupe', model: 'coupe.glb', color: '#3a6fc9', realWheels: true, icon: 'sport', fixedRims: true },
  { id: 'sedan', label: 'Sedan', model: 'sedan.glb', color: '#c9b53a', realWheels: true, icon: 'sedan', fixedRims: true },
  { id: 'compact', label: 'Kompakt', model: 'compact.glb', color: '#3ac98f', realWheels: true, icon: 'hatch', fixedRims: true },
  { id: 'hatchback', label: 'Xetchbek', model: 'hatchback.glb', color: '#c97a3a', realWheels: true, icon: 'hatch', fixedRims: true },
  { id: 'wagon', label: 'Universal', model: 'wagon.glb', color: '#8a8f99', realWheels: true, icon: 'wagon', fixedRims: true },
  { id: 'minivan', label: 'Miniven', model: 'minivan.glb', color: '#b8bcc4', realWheels: true, icon: 'van', fixedRims: true },
  { id: 'suv', label: 'Jip', model: 'suv.glb', color: '#2f3a4a', realWheels: true, icon: 'suv', fixedRims: true },
  { id: 'offroad', label: 'Offroad', model: 'offroad.glb', color: '#4d6b3a', realWheels: true, icon: 'suv', fixedRims: true },
  { id: 'pickup', label: 'Pikap', model: 'pickup.glb', color: '#9a3a2a', realWheels: true, icon: 'pickup', fixedRims: true },
];

/** Yangi mashina qo'shilganda id shu yerga ham yoziladi (CarId tipi shundan) */
const CAR_IDS = [
  'red',
  'green',
  'orange',
  'white',
  'super',
  'rally',
  'sport',
  'coupe',
  'sedan',
  'compact',
  'hatchback',
  'wagon',
  'minivan',
  'suv',
  'offroad',
  'pickup',
] as const;

export interface CarDef {
  id: CarId;
  label: string;
  model: string;
  color: string;
  realWheels?: boolean;
  /** Menyudagi rasm shakli (standart — bagi) */
  icon?: CarIconShape;
  /** Disk alohida qism emas (tekstura atlasida) — disk rangi tuningi bu mashinaga ta'sir qilmaydi */
  fixedRims?: boolean;
}

export type CarId = (typeof CAR_IDS)[number];
export type CarIconShape = 'buggy' | 'sport' | 'sedan' | 'hatch' | 'wagon' | 'van' | 'suv' | 'pickup';
export const DEFAULT_CAR: CarId = 'red';

export function isCarId(v: unknown): v is CarId {
  return CARS.some((c) => c.id === v);
}

export const RACE = {
  /** Birinchi o'yinchi marraga yetgach, qolganlarga shuncha vaqt beriladi */
  FINISH_GRACE_MS: 45_000,
  /** Xavfsizlik uchun: poyga shundan uzoq davom etmaydi */
  MAX_DURATION_MS: 10 * 60_000,
  /** Reyting (o'rinlar) tarqatish chastotasi */
  STANDINGS_HZ: 5,
} as const;

export const CAR = {
  /** Maksimal oldinga tezlik (m/s) ≈ 108 km/h */
  MAX_SPEED: 30,
  MAX_REVERSE_SPEED: 8,
  /** Har bir g'ildirakka beriladigan dvigatel kuchi (4x4 baggi) */
  ENGINE_FORCE: 300,
  /** Tormoz — Rapier'da har qadamdagi maksimal to'xtatuvchi impuls (g'ildirak boshiga) */
  BRAKE_FORCE: 5,
  HANDBRAKE_FORCE: 5,
  /** Gaz bosilmaganda sekin to'xtash */
  ROLLING_BRAKE: 1.2,
  /** Past tezlikdagi maksimal rul burchagi (radian) */
  MAX_STEER: 0.55,
  /** Maksimal tezlikda rul burchagi MAX_STEER ning shu ulushiga kamayadi */
  HIGH_SPEED_STEER_FACTOR: 0.14,
  /** Rulni burish / markazga qaytarish tezligi (rad/s) — silliq burilish uchun */
  STEER_SPEED: 2.5,
  STEER_RETURN_SPEED: 4,

  MASS: 150,
  /** Shassi collideri yarim o'lchamlari [x, y, z] */
  CHASSIS_HALF_EXTENTS: [0.85, 0.3, 1.45] as const,
  /** Og'irlik markazi pastroq — ag'darilishga chidamliroq */
  CENTER_OF_MASS_Y: -0.4,
  ANGULAR_DAMPING: 0.8,

  WHEEL_RADIUS: 0.42,
  WHEEL_WIDTH: 0.34,
  /** G'ildirak ulanish nuqtalari (shassi lokal koordinatalarida), tartib: FL, FR, RL, RR */
  WHEEL_POSITIONS: [
    [0.95, -0.05, 1.1],
    [-0.95, -0.05, 1.1],
    [0.95, -0.05, -1.05],
    [-0.95, -0.05, -1.05],
  ] as const,

  /** Suspensiya (Rapier DynamicRayCastVehicleController parametrlari) */
  SUSPENSION_REST_LENGTH: 0.4,
  SUSPENSION_TRAVEL: 0.35,
  SUSPENSION_STIFFNESS: 26,
  SUSPENSION_COMPRESSION: 2.8,
  SUSPENSION_RELAXATION: 3.6,
  FRICTION_SLIP: 2.4,
  SIDE_FRICTION: 1.0,
  /** Qo'l tormozi bosilganda orqa g'ildiraklarning yon ishqalanishi (drift) */
  DRIFT_SIDE_FRICTION: 0.3,

  /** Ag'darilib qolsa shuncha vaqtdan keyin avtomatik respawn */
  FLIP_RESPAWN_DELAY_MS: 1500,

  BOOST_MULTIPLIER: 1.5,
  BOOST_DURATION_MS: 2500,
  /** Boost olingan zahoti qo'shiladigan tezlik (m/s) */
  BOOST_KICK: 6,
  /** Nitro bak hajmi har upgrade darajasiga (ms); tezlik multiplikatori — BOOST_MULTIPLIER */
  NITRO_MS_PER_LEVEL: 1200,
} as const;

export const ANTI_CHEAT = {
  /** Server qabul qiladigan tezlik = MAX_SPEED * BOOST_MULTIPLIER * TOLERANCE */
  SPEED_TOLERANCE: 1.35,
  /** Tarmoq kechikishlari uchun qo'shimcha vaqt (s): ruxsat etilgan masofa = maxSpeed * (dt + SLACK) */
  TIME_SLACK: 0.25,
  /** Respawn faqat shu radius ichida checkpoint/start nuqtasiga qabul qilinadi (m) */
  RESPAWN_RADIUS: 8,
  /** Checkpoint/tanga tasdiqlashda radiusga qo'shiladigan zaxira (oxirgi paket 50 ms eski bo'lishi mumkin) */
  CHECKPOINT_RADIUS_TOLERANCE: 6,
} as const;

export const CAMERA = {
  FOV: 60,
  /** Kamera yo'nalishining mashina burilishiga ergashish tezligi */
  HEADING_SHARPNESS: 4,
  /** Maksimal tezlikda FOV shunchaga kattalashadi (tezlik hissi) */
  SPEED_FOV_BOOST: 10,
  /** Boost/nitro paytida qo'shimcha FOV */
  BOOST_FOV: 6,

  /**
   * Kamera rejimlari (V tugmasi bilan navbatma-navbat). offset/look — [yon, tepa, oldinga] (chase kabi heading bo'yicha;
   * hood — mashinaning lokal koordinatalarida). fov — asosiy FOV'ga qo'shimcha.
   */
  MODES: {
    chase: { label: 'Orqadan', offset: [0, 3.2, -7.5], look: [0, 1, 4], sharpness: 5, fov: 0 },
    far: { label: 'Uzoqdan', offset: [0, 5, -12.5], look: [0, 1.2, 5], sharpness: 4, fov: -4 },
    hood: { label: 'Kapot', offset: [0, 0.85, 1.1], look: [0, 0.6, 12], sharpness: 30, fov: 8 },
    top: { label: 'Tepadan', offset: [0, 26, -8], look: [0, 0, 5], sharpness: 3, fov: -10 },
  },

  /** Silkinish (trauma modeli): ofset = trauma² · MAX_OFFSET · shovqin; trauma sekundiga DECAY ga kamayadi */
  SHAKE: {
    MAX_OFFSET: 0.45,
    MAX_ROLL: 0.05,
    DECAY: 1.6,
    FREQUENCY: 22,
    /** Yangi boost / nitro yoqilganda */
    BOOST: 0.45,
    /** Urilish: tezlik keskin o'zgarishi (m/s) shu chegaradan oshsa, trauma = (Δv - chegara) · SCALE */
    HIT_DV: 3.5,
    HIT_SCALE: 0.09,
    /** Maksimal tezlikka yaqinlashganda doimiy yengil tebranish (trauma minimum) */
    SPEED: 0.18,
  },

  /** Burilishda kamera og'ishi (radian) — yaw burchak tezligi × tezlik ulushiga proporsional */
  ROLL: { MAX: 0.07, FACTOR: 0.045, SHARPNESS: 4 },

  /** Sichqoncha bilan aylantirish: radian/piksel, chegaralar, qo'yib yuborilganda qaytish tezligi */
  ORBIT: { SENSITIVITY: 0.006, MAX_PITCH: 0.9, MIN_PITCH: -0.35, RETURN_SHARPNESS: 3 },

  /** Countdown paytidagi intro: mashina atrofida old tomondan orqaga aylanish */
  INTRO: { RADIUS: 7.5, HEIGHT: 2.2, START_ANGLE: Math.PI * 0.9 },
} as const;

export type CameraMode = keyof typeof CAMERA.MODES;
export const CAMERA_MODES = Object.keys(CAMERA.MODES) as CameraMode[];

export const WORLD = {
  /** Deterministik relyef uchun seed — client va server bir xil dunyoni ko'radi */
  SEED: 1337,
  /** Relyef kvadrat o'lchami (m) va to'r bo'linishi (4 m katak) */
  TERRAIN_SIZE: 1000,
  TERRAIN_SEGMENTS: 250,
  /** O'rmon tepaliklari amplitudasi */
  TERRAIN_HEIGHT: 14,
  /** Kanyon devorlari balandligi (yo'ldan) */
  CANYON_WALL: 22,
  GRAVITY: -20,
  /** Shu balandlikdan pastga tushsa respawn */
  KILL_Y: -30,
  /** Yo'l yaqinida (OFF_TRACK_RADIUS ichida) yo'ldan shuncha pastga tushsa (jarlik) — respawn */
  OFF_TRACK_DROP: 8,
  OFF_TRACK_RADIUS: 40,
} as const;

/** Iliq low-poly palitra */
export const COLORS = {
  sky: '#f4c99b',
  fog: '#f2c39a',
  sun: '#fff1d6',
  hemiSky: '#ffe2bd',
  hemiGround: '#6b5238',
  grass: '#8fae55',
  grassDark: '#6e8f3e',
  dirt: '#b98a56',
  rock: '#9c8676',
  sand: '#d9a86c',
  trunk: '#6d4a2f',
  leaves: '#4f7d3a',
  leavesLight: '#6f9c45',
  ruins: '#c9b79a',
  ruinsDark: '#a8987c',
  ruinsGround: '#cfb07a',
  ruinsGrass: '#a9a55c',
  canyonA: '#c8693f',
  canyonB: '#b35a36',
  canyonC: '#d98b56',
  canyonTop: '#d8a765',
  riverbed: '#8a7a66',
  water: '#4f9fb3',
  roadForest: '#a47a4d',
  roadCanyon: '#b98659',
  roadRuins: '#bcab8a',
  roadEdge: '#7d5c3a',
  wood: '#8a5a34',
  woodDark: '#5e3c22',
  crystal: '#5ff2ff',
  gold: '#ffc83d',
  checkpoint: '#ff9a2e',
  checkpointPassed: '#8fbf6a',
  car: '#e0572b',
  carDark: '#2f2a28',
} as const;

/** Yorug'lik. Tuman uzoqligi va soya sifati — client'dagi sifat darajalarida (store/quality.ts) */
export const LIGHTING = {
  FOG_NEAR: 40,
  SUN_POSITION: [80, 120, 40] as const,
  SUN_INTENSITY: 2.4,
  HEMI_INTENSITY: 0.9,
  /** Soya kamerasi yoritadigan maydon yarim o'lchami */
  SHADOW_EXTENT: 60,
} as const;
