import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
