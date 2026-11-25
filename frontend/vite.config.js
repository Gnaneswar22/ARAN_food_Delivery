import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const proxy = { '/api': { target: 'http://localhost:5000', changeOrigin: true }, '/socket.io': { target: 'http://localhost:5000', ws: true } };

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt', // user-controlled update notification
      includeAssets: ['icons/*.png', 'icons/*.svg', 'offline.html'],
      manifest: {
        name: 'ARAN.co – Good Food. Great Moments.',
        short_name: 'ARAN.co',
        description: 'Order fresh, premium food for delivery or pickup from ARAN.co.',
        theme_color: '#E87535',
        background_color: '#F7F2E9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/admin/],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          // Public, non-personal menu data only. Everything else under /api is network-only (never cached).
          { urlPattern: ({ url }) => /^\/api\/v1\/(products|categories|settings)(\/|\?|$)/.test(url.pathname) && !url.pathname.includes('/account'),
            handler: 'NetworkFirst', options: { cacheName: 'aran-menu', networkTimeoutSeconds: 4, expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 }, cacheableResponse: { statuses: [200] } } },
          { urlPattern: ({ url }) => /res\.cloudinary\.com/.test(url.hostname), handler: 'CacheFirst', options: { cacheName: 'aran-images', expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 }, cacheableResponse: { statuses: [0, 200] } } },
          { urlPattern: ({ url }) => /^\/api\//.test(url.pathname) || /razorpay/.test(url.hostname), handler: 'NetworkOnly' },
        ],
      },
    }),
  ],
  server: { port: 5173, allowedHosts: true, proxy },
  preview: { port: 5173, proxy },
  build: { sourcemap: false, chunkSizeWarningLimit: 600 },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test-setup.js'], include: ['src/**/*.test.{js,jsx}'] },
});
