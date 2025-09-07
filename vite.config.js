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
        lang: 'en',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
        shortcuts: [
          {
            name: 'PDF to Markdown',
            short_name: 'PDF → MD',
            description: 'Convert PDF content into Markdown',
            url: '/#/pdf-to-markdown',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'MP4 to MP3',
            short_name: 'MP4 → MP3',
            description: 'Convert video to MP3 in-browser',
            url: '/#/mp4-to-mp3',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Audio Transcriber',
            short_name: 'Transcriber',
            description: 'Transcribe audio to Markdown',
            url: '/#/audio-transcriber',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Information Verifier',
            short_name: 'Verifier',
            description: 'Verify information with citations',
            url: '/#/information-verifier',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
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
