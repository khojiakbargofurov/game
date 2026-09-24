# Adventure Racer

Brauzerda ishlaydigan low-poly 3D onlayn poyga o'yini: o'rmon → kanyon → qadimiy xarobalar → marra.

**Texnologiyalar:** Vite + React + TypeScript · three.js / @react-three/fiber / drei · @react-three/rapier · zustand · Node.js + Socket.io

## Tuzilma

```
client/   Vite + React + R3F o'yin klienti
server/   Node.js + Socket.io o'yin serveri (lobby, xonalar, sinxronizatsiya, anti-cheat)
shared/   Umumiy konstantalar (config.ts), socket event tiplari (events.ts), relyef funksiyasi
```

Barcha sozlanadigan qiymatlar (tezlik, rul, tick rate, max o'yinchi, ranglar) — `shared/src/config.ts`.

## O'rnatish

Talab: Node.js 20+ (tavsiya: 24).

```bash
npm install
```

## Lokal ishga tushirish

```bash
npm run dev
```

Bu client va serverni birga ishga tushiradi:

- Client: http://localhost:5173
- Server: http://localhost:3001 (`/health` — holat tekshiruvi)

Boshqa buyruqlar:

```bash
npm run typecheck   # barcha paketlarni TS tekshiruvi
npm run build       # client production build (client/dist)
npm start           # serverni production rejimida ishga tushirish
npm run sim -w client        # mashina fizikasini headless sinash (tezlanish, tormoz, burilish, drift)
npm run sim:route -w client  # avtopilot butun marshrutni bosib o'tadi (yo'l haydashga yaroqliligi)
npm run sim:stress -w client # agressiv haydovchi (boost tezligida): korpus-relyef tegishi, ag'darilish
npm run smoke -w server       # server smoke-testi (server ishlab turgan bo'lishi kerak)
npm run test:interp -w client # snapshot interpolyatsiya testlari
```

## HUD va ovoz

- **HUD** (`client/src/ui/hud/`): o'rin va vaqt, tangalar, keyingi checkpointga yo'nalish strelkasi va masofa
  (marshrut bo'ylab; "teskari yo'nalish" / "checkpoint o'tkazib yuborildi" ogohlantirishlari),
  tezlik shkalasi va boost indikatori, butun trassa mini-xaritasi (barcha o'yinchilar rangli nuqta).
- **Ovoz** (`client/src/audio/`): hammasi Web Audio'da generatsiya qilinadi, fayl yo'q —
  dvigatel (tezlik/uzatmaga qarab), shinalar chiyillashi (drift), shamol, tanga, boost, checkpoint,
  3-2-1 signallari, marra fanfarasi, urilish va respawn. Ovoz birinchi bosish/tugmadan keyin yoqiladi
  (brauzer talabi).

## Ishlash (performance)

- **Grafika sifati** menyuda: *Past / O'rta / Yuqori* (saqlanadi) yoki URL orqali `?quality=low|medium|high`.
  Kam yadroli yoki mobil qurilmalarda standart — *O'rta*. Fizika va colliderlar hamma darajada bir xil
  (multiplayer adolatli bo'lishi uchun), faqat vizual detallar farq qiladi:

  | Daraja | Piksel zichligi | Soyalar | Manzara (dekor) | Tuman |
  | --- | --- | --- | --- | --- |
  | Past | 0.75–1 | yo'q | 35% | 190 m |
  | O'rta | 1–1.25 | 1024 | 70% | 230 m |
  | Yuqori | 1–1.75 | 2048 | 100% | 260 m |

- **Adaptiv piksel zichligi** (drei `PerformanceMonitor`): FPS tushsa avtomatik kamayadi.
- **P** tugmasi yoki `?perf` — FPS, draw call, uchburchaklar paneli.
- Optimizatsiyalar: relyef va manzara bo'laklarga bo'lingan (frustum culling), daraxt/qoya/tanga/taxta/ustunlar —
  instancing, ko'prik/xarobalar/mashina — birlashtirilgan geometriya, kamera uzoqligi tumanga mos,
  3D dunyo lazy yuklanadi (menyu darhol ochiladi), countdown dunyo tayyor bo'lgach boshlanadi.
- O'rmon startida (Yuqori): 255 → ~110 draw call, 286k → ~133k uchburchak; Past: ~70 draw call, ~71k.

```bash
npm run profile:load -w client   # yuklanish bosqichlari vaqti (relyef, manzara, Rapier collider)
```

## Mashinalar

Menyuda 4 ta mashinadan biri tanlanadi: Qizil, Yashil, To'q sariq, Oq (Kenney Racing Kit, `client/public/model/`).
Tanlov brauzerda saqlanadi; onlayn xonada boshqa o'yinchilar ham sizning mashinangizni ko'radi.
Ro'yxat — `shared/src/config.ts` dagi `CARS`. Fizika hamma mashinada bir xil (adolatli poyga).

## Multiplayer

1. Menyuda ism kiriting → **Xona yaratish** → 6 belgili kod chiqadi.
2. Boshqa o'yinchilar kodni kiritib **Qo'shilish** bosadi (2–8 o'yinchi).
3. Xona egasi (👑) **Start** bosadi → **3-2-1** countdown (boshqaruv qulf) → poyga.
4. Hamma marraga yetganda (yoki birinchi o'yinchidan 45 s keyin — qolganlarga ekranda teskari sanoq ko'rsatiladi) — **natijalar jadvali**;
   xona egasi **Qayta o'ynash** yoki **Lobbyga qaytish** ni tanlaydi.

Bitta kompyuterda sinash uchun: ikkinchi brauzer oynasi yoki test-bot:

```bash
npm run bot -w server -- ABC123                 # xonaga bot qo'shish (marshrut bo'ylab haydaydi)
npm run bot -w server -- ABC123 --speed 25 --name Botir
npm run bot -w server -- ABC123 --car orange    # bot mashinasi (red | green | orange | white)
npm run bot -w server -- ABC123 --cheat         # anti-cheat sinovi
```

Qanday ishlaydi:

- Har bir klient o'z holatini (pozitsiya, aylanish, tezlik) **20 Hz** da yuboradi; server har bir xonaga
  barcha o'yinchilar snapshotini 20 Hz da tarqatadi.
- Klient boshqa o'yinchilarni **~100 ms** kechikish bilan ikki snapshot orasida interpolyatsiya qiladi
  (`client/src/net/snapshotBuffer.ts`); server soati bilan farq `serverClock.ts` da baholanadi.
- **Anti-cheat** (`server/src/antiCheat.ts`): haddan tashqari tezlik va teleport-sakrashlar rad etiladi,
  o'yinchi oxirgi to'g'ri holatga qaytariladi; respawn faqat o'z start joyiga yoki oxirgi o'tilgan checkpointga ruxsat etiladi.
- **Poyga qoidalari serverda** (`server/src/race.ts`): checkpoint faqat navbat bilan va o'yinchi haqiqatan
  o'sha joyda bo'lsa qabul qilinadi; marra vaqti, tangalar va o'rinlar (reyting, 5 Hz) server tomonida hisoblanadi.
- Uzilgan o'yinchi xonadan darhol o'chiriladi; host chiqsa, keyingi o'yinchi host bo'ladi; bo'sh xona o'chiriladi.

Debug:

- `http://localhost:5173/?debug` — fizika colliderlarini ko'rsatadi.
- Dev rejimda brauzer konsolida: `__goto(700)` — mashinani marshrutning 700-metriga ko'chirish, `__state()` — mashina holati,
  `__perf()` — draw call/uchburchaklar, `__quality('low')` — sifatni almashtirish, `__setRespawn(100)` — respawn nuqtasini teleportsiz o'zgartirish.

## Trassa

Marshrut (~1300 m) `shared/src/route.ts` dagi nazorat nuqtalaridan quriladi; barcha obyektlar
(checkpointlar, tangalar, rampalar, ko'prik, tunnel, to'siqlar) `shared/src/track.ts` da marshrut bo'ylab
masofa (`s`, metr) orqali beriladi. Relyef (`shared/src/terrain.ts`) marshrutga moslashadi:

1. **O'rmon** (0–480 m): tepaliklar, yiqilgan daraxtlar, rampa.
2. **Ko'prik** jarlik va daryo ustidan (450–505 m).
3. **Kanyon** (480–880 m): tik qoya devorlar, dumalab tushuvchi toshlar, boost + rampa, g'or-tunnel.
4. **Qadimiy xarobalar** (880–1300 m): ustunlar, arkalar, yiqilgan ustunlar, tor yo'lak, marra.

## Boshqaruv

| Tugma | Amal |
| --- | --- |
| ↑ | Gaz |
| ↓ | Tormoz / orqaga |
| ← → | Rul |
| Space | Qo'l tormozi (drift) |
| R | Oxirgi checkpointga qaytish |
| M | Ovozni yoqish/o'chirish |
| C | Kamera rejimi (debug: chase / erkin) |
| P | Ishlash ko'rsatkichlari (FPS, draw call) |

## Deploy

Client — statik sayt, server — doimiy ishlaydigan Node jarayoni (WebSocket).

**Server** (Render, Railway, Fly.io yoki istalgan VPS):

- Build: `npm install`
- Start: `npm start`
- Env: `PORT` (odatda platforma o'zi beradi), `CORS_ORIGIN=https://sizning-client-domeningiz`

**Client** (Vercel, Netlify, Cloudflare Pages):

- Root: repo ildizi, build: `npm run build`, output: `client/dist`
- Env: `VITE_SERVER_URL=https://sizning-server-domeningiz`

## Holat

- [x] 1. Loyiha tuzilmasi, sahna, yer, yorug'lik, kamera
- [x] 2. Mashina fizikasi va boshqaruv
- [x] 3. Adventure trassasi
- [x] 4. Server, lobby, sinxronizatsiya
- [x] 5. Poyga logikasi
- [x] 6. HUD, mini-xarita, ovoz
- [x] 7. Optimizatsiya
