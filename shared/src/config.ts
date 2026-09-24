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
  /** Mashinaga nisbatan kamera ofseti (orqada, tepada) */
  OFFSET: [0, 3.2, -7.5] as const,
  /** Kamera qarab turadigan nuqta ofseti (mashina oldida) */
  LOOK_AHEAD: [0, 1, 4] as const,
  /** Lerp koeffitsiyenti (1/s) — kattaroq qiymat = qattiqroq kuzatish */
  FOLLOW_SHARPNESS: 5,
  /** Kamera yo'nalishining mashina burilishiga ergashish tezligi */
  HEADING_SHARPNESS: 4,
  /** Maksimal tezlikda FOV shunchaga kattalashadi (tezlik hissi) */
  SPEED_FOV_BOOST: 10,
} as const;

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
