import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      manifest: {
        name: '매점이지 - Maejum Easy',
        short_name: '매점이지',
        description: '매점 상품 관리 및 구매 기록 서비스',
        theme_color: '#3b82f6',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  // HMR 주소는 Vite가 접속 주소에 맞춰 자동 감지하도록 둡니다.
  server: { port: 5173, strictPort: true },
});
