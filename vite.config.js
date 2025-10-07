import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    // Lightweight dev-only API to validate Mermaid via cURL
    {
      name: 'mermaid-validate-api',
      configureServer(server) {
        // No heuristic validation here; only real Mermaid parser

        const parseBody = async (req) => new Promise((resolve) => {
          let data = ''
          req.on('data', (chunk) => { data += chunk })
          req.on('end', () => {
            const ct = String(req.headers['content-type'] || '')
            if (ct.includes('application/json')) {
              try { resolve(JSON.parse(data)) } catch { resolve({}) }
              return
            }
            resolve({ raw: data })
          })
        })

        server.middlewares.use('/api/mermaid/validate', async (req, res) => {
          try {
            const url = new URL(req.url, 'http://localhost')
            let text = ''
            const b64 = url.searchParams.get('b64')
            const q = url.searchParams.get('q') || url.searchParams.get('text')
            if (b64) {
              try { text = Buffer.from(b64, 'base64').toString('utf8') } catch {}
            } else if (q) {
              text = q
            }

            if (!text && req.method === 'POST') {
              const body = await parseBody(req)
              if (body?.b64) {
                try { text = Buffer.from(body.b64, 'base64').toString('utf8') } catch {}
              }
              if (!text && body?.text) text = String(body.text)
              if (!text && body?.raw) text = String(body.raw)
            }

            if (!String(text || '').trim()) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Cache-Control', 'no-store')
              res.end(JSON.stringify({ valid: false, error: 'Missing Mermaid definition. Provide ?b64= or ?text=, or POST { b64 | text }.' }))
              return
            }
            // Normalize common escaped newlines from query usage like %5Cn
            text = String(text).replace(/\r\n/g, '\n').replace(/\\n/g, '\n')

            let valid = false
            let error = undefined
            let parser = 'none'

            // Try local mermaid if available
            let mermaid
            try {
              // Ensure a browser-like DOM for dompurify hooks used by mermaid
              if (typeof window === 'undefined' || !globalThis.window?.document) {
                const { JSDOM } = await import('jsdom')
                const { window } = new JSDOM('<!doctype html><html><body></body></html>')
                globalThis.window = window
                globalThis.document = window.document
                globalThis.self = window
              }
              const mod = await import('mermaid')
              mermaid = mod?.default || mod
            } catch (e) {
              mermaid = null
            }

            if (mermaid) {
              try { mermaid.initialize?.({ startOnLoad: false }) } catch {}
              try {
                if (typeof mermaid.parse === 'function') {
                  const maybe = mermaid.parse(text)
                  if (maybe && typeof maybe.then === 'function') await maybe
                  valid = true
                  parser = 'mermaid'
                } else if (mermaid?.mermaidAPI?.parse) {
                  mermaid.mermaidAPI.parse(text)
                  valid = true
                  parser = 'mermaid'
                } else {
                  valid = false
                  error = 'Mermaid loaded without a parser API. Cannot validate without parser.'
                  parser = 'mermaid'
                }
              } catch (e) {
                valid = false
                error = e?.message || String(e)
                parser = 'mermaid'
              }
            } else {
              valid = false
              error = 'Mermaid parser unavailable in dev. Install mermaid and jsdom.'
              parser = 'none'
            }

            // Status: 200 (valid), 422 (invalid syntax), 501 (parser unavailable)
            if (parser !== 'mermaid' && !valid) {
              res.statusCode = 501
            } else {
              res.statusCode = valid ? 200 : 422
            }
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'no-store')
            res.end(JSON.stringify({ valid, error, parser }))
          } catch (e) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'no-store')
            res.end(JSON.stringify({ valid: false, error: e?.message || String(e) }))
          }
        })
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Toolbox',
        short_name: 'Toolbox',
        description: 'Toolbox — in‑browser AI & developer tools',
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
            url: '/pdf-to-markdown',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'MP4 to MP3',
            short_name: 'MP4 → MP3',
            description: 'Convert video to MP3 in-browser',
            url: '/mp4-to-mp3',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Audio Transcriber',
            short_name: 'Transcriber',
            description: 'Transcribe audio to Markdown',
            url: '/audio-transcriber',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Information Verifier',
            short_name: 'Verifier',
            description: 'Verify information with citations',
            url: '/information-verifier',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        // Exclude huge ffmpeg wasm from precache to avoid build errors on Vercel
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2,json}'],
        globIgnores: ['**/ffmpeg/**', '**/*.wasm'],
        // Do not serve SPA shell for API navigations
        navigateFallbackDenylist: [/^\/api\//],
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
  server: {
    allowedHosts: ["tunnel.nurcholis.art"]
  }
})
