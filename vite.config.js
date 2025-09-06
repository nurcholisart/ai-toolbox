import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'AI Toolbox',
        short_name: 'AI Toolbox',
        description: 'AI Toolbox — your one‑stop AI tools hub',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        lang: 'id',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // Exclude huge ffmpeg wasm from precache to avoid build errors on Vercel
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2,json}'],
        globIgnores: ['**/ffmpeg/**', '**/*.wasm'],
        // Runtime cache ffmpeg assets after first use
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/ffmpeg/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ffmpeg-assets',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 4, maxAgeSeconds: 7 * 24 * 60 * 60 },
              matchOptions: { ignoreSearch: true },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  optimizeDeps: {
    // Avoid pre-bundling ffmpeg packages; it breaks worker resolution
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
})
