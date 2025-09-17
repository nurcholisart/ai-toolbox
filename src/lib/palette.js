import { oklchToHex, parseColorToOklch, stepsDefault, ensureNumber, contrastRatio, hexToRgb, rgbToHex, oklchToRgb } from './colors.js'

export const semanticFamilies = ['primary','secondary','accent','neutral','info','success','warning','error']

// Default options
const DEFAULTS = {
  algo: 'oklch',
  chroma: 0.12,
  steps: stepsDefault,
}

// Generate a monotonic lightness progression around base.l
export const generateLightnessScale = (baseL) => {
  // Targets for extremes
  const lightMax = 0.98
  const darkMin = 0.14
  // Steps indices: 50..900 with 500 center
  const idx = [50,100,200,300,400,500,600,700,800,900]
  const out = {}
  // Distances from center in normalized units (tension tweaks)
  const up = [0.9,0.75,0.6,0.4,0.2] // toward lightMax
  const down = [0.12,0.22,0.33,0.46,0.6] // toward darkMin
  out[500] = baseL
  for (let i = 0; i < 5; i++) {
    const tUp = up[4 - i] // 50 is farthest
    const tDown = down[i]
    out[idx[i]] = baseL + (lightMax - baseL) * tUp
    out[idx[6 + i]] = baseL - (baseL - darkMin) * tDown
  }
  // Clamp monotonic
  let prev = 1
  for (const k of idx) {
    out[k] = Math.min(prev, Math.max(0, out[k]))
    prev = out[k]
  }
  return out
}

export const generateRamp = (inputColor, opts = {}) => {
  const o = { ...DEFAULTS, ...opts }
  const base = typeof inputColor === 'string' ? parseColorToOklch(inputColor) : inputColor
  if (!base) return null
  // Keep base hue; adjust chroma to target with soft damping at ends
  const L = generateLightnessScale(base.l)
  const steps = o.steps || stepsDefault
  const ramp = {}
  for (const k of steps) {
    const l = L[k]
    const edge = Math.min((l - 0.14) / (0.98 - 0.14), (0.98 - l) / (0.98 - 0.14))
    const damp = Math.pow(Math.max(0, edge), 0.5)
    const c = Math.max(0, (o.chroma ?? DEFAULTS.chroma) * (0.8 + 0.4 * damp))
    const oklch = { l, c, h: base.h }
    ramp[k] = {
      oklch,
      hex: oklchToHex(oklch),
    }
  }
  return ramp
}

export const familiesFromParams = (params) => {
  const list = String(params.get('families') || 'primary,accent,neutral,info')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const unique = [...new Set(list.filter((f) => semanticFamilies.includes(f)))]
  return unique.length ? unique : ['primary','accent','neutral','info']
}

export const readBaseColorsFromParams = (families, params) => {
  const out = {}
  for (const f of families) {
    const v = params.get(f)
    if (v) out[f] = v
  }
  return out
}

export const buildTailwindColorsObject = (familyRamps) => {
  const out = {}
  for (const [family, ramp] of Object.entries(familyRamps)) {
    const obj = {}
    for (const [k, v] of Object.entries(ramp)) obj[k] = v.hex
    out[family] = obj
  }
  return out
}

export const makeTailwindConfigJSON = (familyRamps) => {
  const colors = buildTailwindColorsObject(familyRamps)
  return JSON.stringify({ theme: { extend: { colors } } }, null, 2)
}

export const makeCssVars = (familyRamps, mode = 'light') => {
  let lines = []
  const neutral = familyRamps.neutral || familyRamps.primary
  const bgLight = neutral?.[50]?.hex || '#FFFFFF'
  const fgLight = neutral?.[900]?.hex || '#000000'
  const bgDark = neutral?.[900]?.hex || '#000000'
  const fgDark = neutral?.[50]?.hex || '#FFFFFF'
  lines.push(':root {')
  lines.push(`  --bg: var(--color-neutral-50);`)
  lines.push(`  --fg: var(--color-neutral-900);`)
  for (const [family, ramp] of Object.entries(familyRamps)) {
    for (const step of Object.keys(ramp)) {
      lines.push(`  --color-${family}-${step}: ${ramp[step].hex};`)
    }
  }
  lines.push('}')
  lines.push(':root[data-theme="dark"] {')
  lines.push(`  --bg: var(--color-neutral-900);`)
  lines.push(`  --fg: var(--color-neutral-50);`)
  lines.push('}')
  return lines.join('\n')
}

// Tailwind v4 uses @theme tokens for colors
// Generate a @theme block with --color-{family}-{step} variables
// and convenient aliases --color-{family} -> 500 step
export const makeTailwindV4Theme = (familyRamps) => {
  const lines = []
  lines.push('@theme {')
  for (const [family, ramp] of Object.entries(familyRamps)) {
    for (const [step, val] of Object.entries(ramp)) {
      lines.push(`  --color-${family}-${step}: ${val.hex};`)
    }
  }
  // Aliases to the 500 step for simple usage (e.g., bg-primary)
  for (const family of Object.keys(familyRamps)) {
    if (familyRamps[family]?.[500]?.hex) {
      lines.push(`  --color-${family}: var(--color-${family}-500);`)
    }
  }
  lines.push('}')
  return lines.join('\n')
}

export const wcagBadgesForFamily = (family, ramps) => {
  const fam = ramps[family]
  const neutral = ramps.neutral || ramps.primary
  if (!fam) return []
  const pairs = []
  const hexToRgbSafe = (h) => hexToRgb(h || '#000000')
  const addPair = (label, fg, bg) => {
    const r = contrastRatio(hexToRgbSafe(fg), hexToRgbSafe(bg))
    const AA = r >= 4.5
    const AAA = r >= 7
    pairs.push({ label, ratio: +r.toFixed(2), AA, AAA })
  }
  addPair('text-*-900 on bg-*-50', fam[900].hex, fam[50].hex)
  addPair('text-*-800 on bg-neutral-50', fam[800].hex, neutral[50].hex)
  addPair('text-neutral-900 on bg-*-50', neutral[900].hex, fam[50].hex)
  addPair('text-white on bg-*-700', '#FFFFFF', fam[700].hex)
  addPair('text-white on bg-*-800', '#FFFFFF', fam[800].hex)
  addPair('text-white on bg-*-900', '#FFFFFF', fam[900].hex)
  return pairs
}

export const safePairingsSummary = (family, ramps, target = 'AA') => {
  const pairs = wcagBadgesForFamily(family, ramps)
  const want = target === 'AAA' ? 'AAA' : 'AA'
  return pairs.filter((p) => p[want]).map((p) => p.label)
}
