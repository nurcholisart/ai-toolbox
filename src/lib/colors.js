// Color utilities: parse/format, OKLCH conversions, luminance, contrast
// Internal representation uses OKLCH: { l: 0..1, c: 0..?, h: 0..360 }

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const degNorm = (h) => ((h % 360) + 360) % 360

// sRGB <-> linear
const srgbToLinear = (u) => {
  u = clamp01(u)
  return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4)
}
const linearToSrgb = (u) => {
  u = Math.max(0, u)
  return u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055
}

// Relative luminance (WCAG) given sRGB 0..1
export const relativeLuminance = ([r, g, b]) => {
  const R = srgbToLinear(r)
  const G = srgbToLinear(g)
  const B = srgbToLinear(b)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

export const contrastRatio = (fgRgb, bgRgb) => {
  const L1 = relativeLuminance(fgRgb)
  const L2 = relativeLuminance(bgRgb)
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}

// HEX helpers
export const rgbToHex = ([r, g, b]) => {
  const to = (v) => {
    const n = Math.round(clamp01(v) * 255)
    return n.toString(16).padStart(2, '0')
  }
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase()
}
export const hexToRgb = (hex) => {
  const s = String(hex || '').trim()
  const m = s.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return [r, g, b]
}

// HSL parsing and conversion to sRGB
const hslToRgb = (h, s, l) => {
  h = ((h % 360) + 360) % 360
  s = clamp01(s)
  l = clamp01(l)
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = h / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let [r1, g1, b1] = [0, 0, 0]
  if (hp < 1) [r1, g1, b1] = [c, x, 0]
  else if (hp < 2) [r1, g1, b1] = [x, c, 0]
  else if (hp < 3) [r1, g1, b1] = [0, c, x]
  else if (hp < 4) [r1, g1, b1] = [0, x, c]
  else if (hp < 5) [r1, g1, b1] = [x, 0, c]
  else [r1, g1, b1] = [c, 0, x]
  const m = l - c / 2
  return [r1 + m, g1 + m, b1 + m]
}

// OkLab/OkLch conversion (Bjorn Ottosson)
// sRGB -> OkLab
const srgbToOklab = ([r, g, b]) => {
  const rl = srgbToLinear(r)
  const gl = srgbToLinear(g)
  const bl = srgbToLinear(b)
  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl
  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
  const b2 = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
  return { L, a, b: b2 }
}

// OkLab -> sRGB
const oklabToSrgb = ({ L, a, b }) => {
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
  const rl = +4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_
  const gl = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_
  const bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_
  const r = linearToSrgb(rl)
  const g = linearToSrgb(gl)
  const b3 = linearToSrgb(bl)
  return [r, g, b3]
}

export const oklchToOklab = ({ l, c, h }) => {
  const hr = (h * Math.PI) / 180
  const a = c * Math.cos(hr)
  const b = c * Math.sin(hr)
  return { L: l, a, b }
}
export const oklabToOklch = ({ L, a, b }) => {
  const c = Math.sqrt(a * a + b * b)
  const h = degNorm((Math.atan2(b, a) * 180) / Math.PI)
  return { l: L, c, h }
}

export const oklchToRgb = ({ l, c, h }) => oklabToSrgb(oklchToOklab({ l, c, h }))
export const rgbToOklch = (rgb) => oklabToOklch(srgbToOklab(rgb))

// Basic gamut mapping: reduce chroma via binary search until in-gamut
export const oklchToHex = (oklch) => {
  let lo = 0, hi = oklch.c
  let ok = oklch
  for (let i = 0; i < 16; i++) {
    const mid = i === 15 ? lo : (lo + hi) / 2
    const trial = { l: oklch.l, c: mid, h: oklch.h }
    const [r, g, b] = oklchToRgb(trial)
    if (r >= 0 && r <= 1 && g >= 0 && g <= 1 && b >= 0 && b <= 1) {
      ok = trial
      lo = mid
    } else {
      hi = mid
    }
  }
  const [r, g, b] = oklchToRgb(ok)
  return rgbToHex([clamp01(r), clamp01(g), clamp01(b)])
}

export const hexToOklch = (hex) => {
  const rgb = hexToRgb(hex)
  return rgb ? rgbToOklch(rgb) : null
}

// Parse input: HEX | hsl(H S% L%) | oklch(L C H)
export const parseColorToOklch = (input) => {
  if (!input) return null
  const s = String(input).trim()
  const hex = hexToOklch(s)
  if (hex) return hex
  // hsl(210 50% 40%) or hsl(210, 50%, 40%)
  let m = s.match(/^hsl\(\s*([\d.]+)\s*[ ,]\s*([\d.]+)%\s*[ ,]\s*([\d.]+)%\s*\)$/i)
  if (!m) m = s.match(/^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/i)
  if (m) {
    const h = parseFloat(m[1])
    const sat = parseFloat(m[2]) / 100
    const lig = parseFloat(m[3]) / 100
    const rgb = hslToRgb(h, sat, lig)
    return rgbToOklch(rgb)
  }
  // oklch(0.65 0.18 280)
  const m2 = s.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\-\d.]+)\s*\)$/i)
  if (m2) {
    const l = parseFloat(m2[1])
    const c = Math.max(0, parseFloat(m2[2]))
    const h = degNorm(parseFloat(m2[3]))
    return { l, c, h }
  }
  return null
}

export const formatOklch = ({ l, c, h }) => `oklch(${(+l.toFixed(4))} ${(+c.toFixed(4))} ${Math.round(h)})`

// Simple OKLCH interpolation between two colors (t in [0,1]) with hue shortest-arc
export const lerpOklch = (a, b, t) => {
  const dh = ((b.h - a.h + 540) % 360) - 180
  return {
    l: a.l + (b.l - a.l) * t,
    c: a.c + (b.c - a.c) * t,
    h: degNorm(a.h + dh * t),
  }
}

export const stepsDefault = [50,100,200,300,400,500,600,700,800,900]

export const ensureNumber = (v, fallback) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

