// Pitch detection algorithms: McLeod Pitch Method (MPM) with parabolic interpolation
// and a YIN fallback (CMND). Also includes note conversion helpers.

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

export function hzToMidi(f, a4 = 440) {
  return 69 + 12 * Math.log2(f / a4)
}

export function midiToHz(m, a4 = 440) {
  return a4 * Math.pow(2, (m - 69) / 12)
}

export function hzToNote(f, a4 = 440) {
  const m = hzToMidi(f, a4)
  const midi = Math.round(m)
  const name = NOTE_NAMES[(midi % 12 + 12) % 12]
  const octave = Math.floor(midi / 12) - 1
  const target = midiToHz(midi, a4)
  const cents = 1200 * Math.log2(f / target)
  return { midi, name, octave, target, cents }
}

export function noteToMidi(note) {
  // note like 'E2', 'A#3'
  const m = note.match(/^(C#?|D#?|E|F#?|G#?|A#?|B)(-?\d)$/i)
  if (!m) return null
  const n = m[1].toUpperCase()
  const o = parseInt(m[2], 10)
  const idx = NOTE_NAMES.indexOf(n)
  if (idx < 0) return null
  return idx + (o + 1) * 12
}

export function noteToHz(note, a4 = 440) {
  const m = noteToMidi(note)
  if (m == null) return null
  return midiToHz(m, a4)
}

// Parabolic interpolation for a discrete peak at index k.
function parabolicInterp(y, k) {
  const x0 = k <= 0 ? k : k - 1
  const x2 = k + 1 >= y.length ? k : k + 1
  const s0 = y[x0]
  const s1 = y[k]
  const s2 = y[x2]
  const denom = (s0 - 2 * s1 + s2)
  const delta = denom !== 0 ? 0.5 * (s0 - s2) / denom : 0
  return k + delta
}

// McLeod Pitch Method (NSDF based)
export function mpmPitch(frame, sr, {
  fMin = 50,
  fMax = 1000,
  peakThreshold = 0.8,
} = {}) {
  const N = frame.length
  const tauMin = Math.max(2, Math.floor(sr / fMax))
  const tauMax = Math.min(N - 2, Math.floor(sr / fMin))
  if (tauMax <= tauMin + 2) return null

  const nsdf = new Float32Array(tauMax + 1)
  // Compute NSDF for tau in [0..tauMax]
  for (let tau = 0; tau <= tauMax; tau++) {
    let ac = 0
    let m = 0
    for (let i = 0; i < N - tau; i++) {
      const x = frame[i]
      const y = frame[i + tau]
      ac += x * y
      m += x * x + y * y
    }
    nsdf[tau] = m > 0 ? (2 * ac) / m : 0
  }

  // Peak picking: find local maxima above threshold after first zero crossing
  let maxIdx = -1
  let maxVal = -1
  let passedZero = false
  for (let tau = tauMin; tau <= tauMax - 1; tau++) {
    if (!passedZero && nsdf[tau] < 0 && nsdf[tau + 1] >= 0) passedZero = true
    if (!passedZero) continue
    const prev = nsdf[tau - 1]
    const curr = nsdf[tau]
    const next = nsdf[tau + 1]
    if (curr > prev && curr > next && curr > peakThreshold && curr > maxVal) {
      maxVal = curr
      maxIdx = tau
    }
  }

  if (maxIdx < 0) return null
  const better = parabolicInterp(nsdf, maxIdx)
  const tau = Math.max(tauMin, Math.min(tauMax, better))
  const hz = sr / tau
  if (!isFinite(hz) || hz < fMin || hz > fMax) return null
  return hz
}

// YIN (CMND) fallback
export function yinPitch(frame, sr, {
  fMin = 50,
  fMax = 1000,
  threshold = 0.15,
} = {}) {
  const N = frame.length
  const tauMin = Math.max(2, Math.floor(sr / fMax))
  const tauMax = Math.min(N - 2, Math.floor(sr / fMin))
  if (tauMax <= tauMin + 2) return null

  const diff = new Float32Array(tauMax + 1)
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0
    for (let i = 0; i < N - tau; i++) {
      const d = frame[i] - frame[i + tau]
      sum += d * d
    }
    diff[tau] = sum
  }
  const cmnd = new Float32Array(tauMax + 1)
  cmnd[0] = 1
  let run = 0
  for (let tau = 1; tau <= tauMax; tau++) {
    run += diff[tau]
    cmnd[tau] = diff[tau] * tau / (run || 1)
  }
  let tau = -1
  for (let t = tauMin; t <= tauMax; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 <= tauMax && cmnd[t + 1] < cmnd[t]) t++
      tau = t
      break
    }
  }
  if (tau < 0) return null
  const better = parabolicInterp(cmnd, tau)
  const hz = sr / better
  if (!isFinite(hz) || hz < fMin || hz > fMax) return null
  return hz
}

