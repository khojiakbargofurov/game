# Adventure Racer

Brauzerda ishlaydigan low-poly 3D onlayn poyga o'yini: 4 trassa (shu jumladan Kenney Racing Kit plitkalaridan yig'ilgan 3 aylanali Gran Pri), 4 fasl, yomg'ir va qor, tangalar evaziga mashina upgrade'lari va tuning, yakka rejimda 0–7 bot.

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
npm run sim:bots -w client   # bot haydovchisi har qiyinlikda 1 aylana (vaqt, respawn, qiyin < o'rta < oson)
npm run sim:pack -w client   # 8 ta bot bitta dunyoda: to'qnashuvdan qochish, tiqilish (3-argument — qiyinlik)
# Simulyatsiyalar argumentlari: [trackId] [weather] [max] [speed|grip] — masalan:
npm run sim:route -w client -- mountain snow      # Tog' dovoni, qor (sirpanchiq yo'l)
npm run sim:stress -w client -- lake rain max     # barcha upgrade'lar 5-darajada
npm run sim:stress -w client -- mountain rain max speed  # + ekstremal sozlash (balans/suspensiya/drift = +1)
npm run sim:pack -w client -- circuit clear hard  # Gran Pri, 8 ta qiyin bot
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

Menyuda 5 ta mashinadan biri tanlanadi: Qizil, Yashil, To'q sariq, Oq (Kenney Racing Kit) va Superkar (teksturali model),
`client/public/model/`.
Tanlov brauzerda saqlanadi; onlayn xonada boshqa o'yinchilar ham sizning mashinangizni ko'radi.
Ro'yxat — `shared/src/config.ts` dagi `CARS`. Mashinalar faqat ko'rinishi bilan farq qiladi.

## Garaj (upgrade'lar)

Poygada yig'ilgan tangalar marradan keyin **garaj hamyoniga** qo'shiladi (onlayn — server tasdiqlagan tangalar).
Menyudagi **🔧 Garaj**da 4 ta upgrade sotib olinadi, har biri 0–5 daraja (narx: 20, 40, 70, 110, 160):

| Upgrade | 5-darajada |
| --- | --- |
| Dvigatel | maksimal tezlik +30%, tezlanish +40% |
| Shinalar | yo'lni tutish +40% (sirpanchiq yo'lda ayniqsa foydali) |
| Boost | davomiyligi +75% |
| Rul | tezlikda burilish +60% |

Formula — `shared/src/upgrades.ts` dagi `carStats()`: client (haydash) va server (anti-cheat tezlik chegarasi) bir xil hisoblaydi.
Hamyon brauzerda (localStorage) saqlanadi; server darajalarni 0–5 ga cheklaydi.
Onlayn xonada egasi lobby'da **"Hamma teng"** ni tanlasa, upgrade'lar o'chadi (hamma 0-darajada).

## Fasl va ob-havo

Menyuda (onlayn — xona egasi lobby'da) tanlanadi, `shared/src/environment.ts`:

- **Fasl** — ranglar palitrasi: ☀️ Yoz, 🍂 Kuz (to'q sariq barglar), ⛄ Qish (qor, qorli qoyalar, bargsiz daraxtlar), 🌸 Bahor (gullagan daraxtlar).
- **Ob-havo** — 🌤️ Ochiq, 🌧️ Yomg'ir, 🌨️ Qor: zarrachalar (`client/src/game/Weather.tsx`, soni grafika sifatiga bog'liq),
  qalinroq tuman, xiraroq quyosh va **sirpanchiq yo'l** — tutish yomg'irda ×0.72, qorda ×0.5 (burilish va tormoz kuchsizroq).

## Multiplayer

1. Menyuda ism kiriting → **Xona yaratish** → 6 belgili kod chiqadi (xona menyudagi trassa/fasl/ob-havo bilan yaratiladi;
   xona egasi lobby'da ularni va upgrade'lar yoqilganini o'zgartira oladi).
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

## Trassalar

Har bir trassa — faqat ma'lumot (`shared/src/tracks/*.ts`, `TrackDef`): nazorat nuqtalari, zonalar
(o'rmon / kanyon / xarobalar) va marshrut bo'ylab masofa (`s`, metr) orqali berilgan obyektlar.
`createTrack()` (`shared/src/tracks/createTrack.ts`) ulardan marshrut, relyef, checkpoint, tanga va boostlarni quradi;
`getTrack(id)` natijani keshlaydi. Client ham, server ham (har xonada o'z trassasi) shu obyektni ishlatadi.

| Trassa | Uzunlik | Yo'l |
| --- | --- | --- |
| **Sarguzasht** (`adventure`) | ~1300 m | o'rmon → ko'prik → kanyon (tunnel, toshlar) → xarobalar (arkalar, tor yo'lak) |
| **Tog' dovoni** (`mountain`) | ~1400 m | o'rmonli serpantin bilan ko'tarilish → qoyali dara, tunnel, dumalaydigan toshlar |
| **Ko'l bo'yi** (`lake`) | ~1420 m | daryo ustidan ko'prik → ko'lni aylanib o'tuvchi o'rmon yo'li → xarobalar |
| **Gran Pri** (`circuit`) | ~1090 m × 3 aylana | Kenney Racing Kit plitkalaridan 8-shakl: start to'g'ri yo'li pit binolari va tribunalar orasida, uning ustidan ko'prik, shimoliy (o'ngga) va janubiy (chapga) halqalar, kerblar, to'siqlar, paddok |

**Aylanali poyga** (`laps` va `startLine` — `TrackDef`da): marshrut yopiq halqa bo'ladi, checkpointlar har aylana uchun
takrorlanadi (`totalS` — poyga boshidan umumiy masofa), har aylana start/marra chizig'idan o'tish bilan tugaydi,
oxirgi aylanada — marra. HUD'da "Aylana 2/3", start panjarasi chiziq ortida (F1 kabi).

**Plitkali trassa** (`tiles` — `TrackDef`da, `shared/src/tracks/tiles.ts`): trassa plitkalar ketma-ketligi sifatida yoziladi —
`['S', n]` to'g'ri, `['R' | 'L', 1 | 2 | 3]` burilish (1×1, 2×2, 3×3 plitka), `['S', 4, 'start']` start panjarasi va arkasi,
`['X', k]` ko'prik (rampa ↑, k ta ochiq oraliq, rampa ↓ — tagidan boshqa to'g'ri yo'l perpendikulyar o'ta oladi, 8-shakl).
Ko'prik/rampalarga trimesh collider; kesishmada marshrutning to'g'ri tarmog'i balandlik bo'yicha tanlanadi
(`nearestOnRoute(x, z, out, y)`). Headless simlar ham shu collider'lar bilan ishlaydi (`scripts/kitColliders.ts`).
Shundan markaziy chiziq (checkpoint, botlar, server shu bilan ishlaydi) va kit modellari joylashuvi hisoblanadi; halqa yopilishi
va plitkalar ustma-ust tushmasligi kerak. Jihozlar (`props`: tribunalar, pit binolari, chodirlar, daraxtlar...) marshrutga nisbatan
(`s`, yon ofset) joylashadi; yo'lga yoki boshqa qattiq jihozga tushib qolganlari avtomatik tashlab yuboriladi.
Logotipli qismlar (bannerlar, pit garajlari, marra bayrog'i) o'z teksturasi bilan; plitka chetidagi o't va daraxtlar — fasl ranglarida. Modellar — `client/public/kit/`
(Kenney Racing Kit, CC0; butun kitdan faqat ishlatilgan GLB'lar).

Yangi trassa qo'shish: `shared/src/tracks/` ga `TrackDef` yozib, `TRACK_DEFS` va `TrackId` ga qo'shish;
so'ng `npm run sim:route -w client -- <id>` bilan oxirigacha haydalishini tekshirish.

## Boshqaruv

| Tugma | Amal |
| --- | --- |
| ↑ yoki W | Gaz |
| ↓ yoki S | Tormoz / orqaga |
| ← → yoki A D | Rul |
| Space | Qo'l tormozi (drift) |
| Shift | Nitro (garajda "Nitro" qismi bo'lsa; boost kristali bakni to'ldiradi) |
| R | Oxirgi checkpointga qaytish |
| V | Kamera: orqadan / uzoqdan / kapot / tepadan |
| Q (ushlab turish) | Orqaga qarash |
| Sichqoncha (tortish) | Mashina atrofida qarash (qo'yib yuborilsa qaytadi) |
| M | Ovozni yoqish/o'chirish |
| C | Debug: erkin (orbit) kamera |
| P | Ishlash ko'rsatkichlari (FPS, draw call) |

## Garaj va botlar

- **Qismlar** (tanga): dvigatel, shinalar, boost, rul, tormoz, yengil kuzov, nitro — 5 darajadan
  (`shared/src/upgrades.ts`, `carStats()` — client ham, server anti-cheat ham shu formulani ishlatadi).
- **Sozlash** (bepul): balans (boshqaruv ↔ tezlik, maks. +5%), suspensiya, drift. Onlayn'da server tekshiradi.
- **Ko'rinish** (tanga): bo'yoq, disklar, spoyler, neon (`shared/src/cosmetics.ts`) — onlayn'da boshqalarga ham ko'rinadi.
- **Botlar** (yakka rejim, menyuda 0–7 ta, oson/o'rta/qiyin): haqiqiy fizikali mashinalar, marshrut bo'ylab
  burilishdan oldin tormozlaydi, oldidagi mashinani aylanib o'tadi, qotib qolsa orqaga chiqadi
  (`client/src/game/bots/botDriver.ts`). O'rin HUD'da va natijalar jadvalida; 1–3-o'rin uchun bonus tanga.

## Deploy

Client — statik sayt, server — doimiy ishlaydigan Node jarayoni (WebSocket).

**Server** — Render uchun tayyor `render.yaml` bor: Render → New → Blueprint → repo'ni tanlang.
Boshqa platformalar (Railway, Fly.io, VPS):

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
