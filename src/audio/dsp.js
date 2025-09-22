// Lightweight DSP helpers for the Chromatic Tuner
// - Windowing, RMS, EMA smoothing, and filter graph setup

export function makeHannCoeffs(N) {
  const w = new Float32Array(N)
  const denom = N - 1
  for (let i = 0; i < N; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / denom))
  return w
}

export function applyWindowInPlace(buf, win) {
  for (let i = 0; i < buf.length; i++) buf[i] *= win[i]
}

export function rms(buf) {
  let s = 0
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]
  return Math.sqrt(s / (buf.length || 1))
}

export function makeEMA(alpha = 0.25, initial = null) {
  let state = initial
  return (x) => {
    if (x == null || !isFinite(x)) return state
    if (state == null) state = x
    else state = alpha * x + (1 - alpha) * state
    return state
  }
}

export function createFilters(ctx, { hpf = 90, lpf = 3000 } = {}) {
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = hpf
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = lpf
  return { hp, lp }
}

