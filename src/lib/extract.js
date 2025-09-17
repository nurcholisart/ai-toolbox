// Best-effort color extraction from site or image with graceful CORS handling
import { hexToRgb, rgbToHex, rgbToOklch } from './colors.js'

const uniqBy = (arr, key) => {
  const seen = new Set()
  const out = []
  for (const item of arr) {
    const k = key(item)
    if (!seen.has(k)) {
      seen.add(k)
      out.push(item)
    }
  }
  return out
}

const findColorsInText = (text) => {
  const hex = [...text.matchAll(/#([0-9a-f]{3}|[0-9a-f]{6})\b/ig)].map((m) => `#${m[1]}`)
  // crude hsl(...) parser to hex via canvas
  const hsl = [...text.matchAll(/hsl\(\s*([\d.]+)\s*[ ,]\s*([\d.]+)%\s*[ ,]\s*([\d.]+)%\s*\)/ig)].map((m) => `hsl(${m[1]} ${m[2]}% ${m[3]}%)`)
  return [...hex, ...hsl]
}

export const fetchSiteColors = async (url) => {
  const out = { colors: [], warnings: [] }
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const html = await res.text()
    const urls = []
    // favicon
    const iconHref = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)/i)
    if (iconHref) urls.push(new URL(iconHref[1], url).href)
    // stylesheets
    const links = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)/ig)]
    for (const m of links) urls.push(new URL(m[1], url).href)
    // Try to fetch resources
    const texts = [html]
    for (const u of urls.slice(0, 3)) {
      try {
        const r = await fetch(u, { mode: 'cors' })
        if (r.ok) texts.push(await r.text())
      } catch {
        out.warnings.push('Blocked by CORS when fetching: ' + u)
      }
    }
    const raw = texts.flatMap(findColorsInText)
    const colors = uniqBy(raw, (s) => s.toLowerCase()).slice(0, 12)
    out.colors = colors
    if (!colors.length) out.warnings.push('No obvious brand colors found; paste colors manually.')
  } catch (e) {
    out.warnings.push('Site fetch failed (CORS or network). Paste colors manually.')
  }
  return out
}

export const extractImageColors = async (imgUrl, k = 5, sample = 40000) => {
  const out = { colors: [], warnings: [] }
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    const loadP = new Promise((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
    })
    img.src = imgUrl
    await loadP

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const maxSide = 240
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const pixels = []
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] / 255
      if (a < 0.5) continue
      const r = data[i] / 255
      const g = data[i + 1] / 255
      const b = data[i + 2] / 255
      pixels.push([r, g, b])
      if (pixels.length > sample) break
    }
    if (!pixels.length) return out

    // K-means in RGB space
    const centroids = []
    for (let i = 0; i < k; i++) centroids.push(pixels[Math.floor(Math.random() * pixels.length)].slice())
    for (let iter = 0; iter < 8; iter++) {
      const sums = Array.from({ length: k }, () => [0, 0, 0])
      const counts = Array.from({ length: k }, () => 0)
      for (const p of pixels) {
        let best = 0, bestD = Infinity
        for (let i = 0; i < k; i++) {
          const c = centroids[i]
          const d = (p[0]-c[0])**2 + (p[1]-c[1])**2 + (p[2]-c[2])**2
          if (d < bestD) { bestD = d; best = i }
        }
        const s = sums[best]
        s[0] += p[0]; s[1] += p[1]; s[2] += p[2]
        counts[best]++
      }
      for (let i = 0; i < k; i++) if (counts[i]) {
        centroids[i][0] = sums[i][0] / counts[i]
        centroids[i][1] = sums[i][1] / counts[i]
        centroids[i][2] = sums[i][2] / counts[i]
      }
    }
    // Sort by chroma in OKLCH (boldest first)
    const withC = centroids.map((rgb) => ({ rgb, oklch: rgbToOklch(rgb) }))
    withC.sort((a, b) => b.oklch.c - a.oklch.c)
    out.colors = withC.map((x) => rgbToHex(x.rgb)).slice(0, k)
  } catch (e) {
    out.warnings.push('Image fetch failed (CORS). Try another URL or download and drop a file.')
  }
  return out
}

