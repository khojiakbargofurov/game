import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // PWA: bosh ekranga o'rnatish + oflayn kesh. Yangi versiya — menyuda "Yangilash" tugmasi (poyga o'rtasida qayta yuklanmasin)
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/icon.svg', 'icons/icon-180.png'],
      manifest: {
        name: 'Adventure Racer',
        short_name: 'Racer',
        description: "Asphalt uslubidagi 3D poyga — yakka va onlayn",
        lang: 'uz',
        // ?app=1 — o'rnatilgan ilovadan ochilganini aniqlash uchun (display-mode: fullscreen brauzerning to'liq ekranida ham rost)
        start_url: '/?app=1',
        scope: '/',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'landscape',
        background_color: '#0a0e16',
        theme_color: '#1a1410',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Ilova qobig'i oldindan keshlanadi (Rapier chunk'i ~2.2MB — chegara oshirilgan)
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // 3D modellar (mashinalar, trassa bo'laklari) — birinchi yuklanganda keshga, keyin tarmoqsiz
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.endsWith('.glb'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'models',
              expiration: { maxEntries: 80 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
  build: {
    // Rapier WASM'i JS ichida (base64) — shuning uchun katta chunk kutilgan holat
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        // Katta vendor kutubxonalar alohida: parallel yuklanadi va o'yin kodi o'zgarganda keshdan olinadi.
        // Diqqat: react, react-dom va scheduler bitta chunk'da bo'lishi shart (aks holda aylanma import
        // tufayli ishga tushish tartibi buziladi). Qolganlarini Rollup o'zi joylaydi.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@dimforge')) return 'rapier';
          if (/node_modules\/three\//.test(id)) return 'three';
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          return undefined;
        },
      },
    },
  },
});
