import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createFilters, makeEMA, makeHannCoeffs, applyWindowInPlace, rms } from '../audio/dsp.js'
import { mpmPitch, yinPitch, hzToNote, noteToHz } from '../audio/pitch.js'
import TunerNeedle from './TunerNeedle.jsx'
import TunerStrobe from './TunerStrobe.jsx'
import TunerControls from './TunerControls.jsx'

// NOTE: Monochrome styling per repo guidelines (Tailwind utilities)
export default function ChromaticTuner() {
  // UI state
  const [status, setStatus] = useState('Idle')
  const [running, setRunning] = useState(false)
  const [a4, setA4] = useState(440)
  const [mode, setMode] = useState('auto') // 'auto' | 'target'
  const [preset, setPreset] = useState('Standard')
  const [stringIndex, setStringIndex] = useState(0)
  const [showStrobe, setShowStrobe] = useState(false)

  // Live outputs
  const [noteText, setNoteText] = useState('—')
  const [freq, setFreq] = useState(0)
  const [cents, setCents] = useState(0)

  // Audio refs
  const audioCtxRef = useRef(null)
  const streamRef = useRef(null)
  const analyserRef = useRef(null)
  const bufRef = useRef(null)
  const hannRef = useRef(null)
  const rafRef = useRef(null)
  const emaHz = useRef(makeEMA(0.25, null))
  const noiseFloorRef = useRef(0)

  // Presets (easily extensible)
  const presets = useMemo(() => ({
    Standard: ['E2','A2','D3','G3','B3','E4'],
    'Drop D': ['D2','A2','D3','G3','B3','E4'],
  }), [])

  function targetNoteName(autoNearest) {
    if (mode === 'target') return presets[preset][stringIndex]
    return autoNearest
  }

  function detectPitch(frame, sr) {
    // Try MPM first
    let hz = mpmPitch(frame, sr, { fMin: 50, fMax: 1000, peakThreshold: 0.8 })
    if (!hz) hz = yinPitch(frame, sr, { fMin: 50, fMax: 1000, threshold: 0.15 })
    return hz
  }

  function updateUIWithHz(hz) {
    if (!hz) {
      setNoteText('—')
      setFreq(0)
      setCents(0)
      return
    }
    const { name, octave, target, cents: cAuto } = hzToNote(hz, a4)
    const nearest = `${name}${octave}`
    const targetName = targetNoteName(nearest)
    let dev = cAuto
    let showName = nearest
    if (mode === 'target' && targetName) {
      const tHz = noteToHz(targetName, a4)
      dev = 1200 * Math.log2(hz / tHz)
      showName = targetName
    }
    setNoteText(showName)
    setFreq(hz)
    setCents(dev)
  }

  // Derive auto-highlighted string index (closest to measured freq)
  const autoStringIndex = useMemo(() => {
    if (!freq || !isFinite(freq)) return null
    const strings = presets[preset]
    let best = null
    let bestAbs = Infinity
    for (let i = 0; i < strings.length; i++) {
      const thz = noteToHz(strings[i], a4)
      if (!thz) continue
      const c = 1200 * Math.log2(freq / thz)
      const a = Math.abs(c)
      if (a < bestAbs) { bestAbs = a; best = i }
    }
    return best
  }, [freq, a4, preset, presets])

  function loop() {
    const analyser = analyserRef.current
    const buf = bufRef.current
    const win = hannRef.current
    if (!analyser || !buf || !win) return

    analyser.getFloatTimeDomainData(buf)
    const level = rms(buf)

    // Basic adaptive gate + status
    const tooNoisy = level > 0.3
    const tooWeak = level < 0.008
    if (tooNoisy) setStatus('Too noisy — move mic closer or reduce noise')
    else if (tooWeak) setStatus('Weak signal — pluck closer to the mic')
    else setStatus('Listening')

    // Windowing for analysis
    applyWindowInPlace(buf, win)
    const sr = analyser.context.sampleRate
    let hz = detectPitch(buf, sr)
    hz = emaHz.current(hz)

    updateUIWithHz(hz)
    rafRef.current = requestAnimationFrame(loop)
  }

  async function start() {
    try {
      setStatus('Requesting microphone permission…')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      const Ctx = window.AudioContext || window.webkitAudioContext
      const ctx = new Ctx({ latencyHint: 'interactive' })
      const src = ctx.createMediaStreamSource(stream)
      const { hp, lp } = createFilters(ctx, { hpf: 90, lpf: 3000 })
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0
      src.connect(hp).connect(lp).connect(analyser)

      audioCtxRef.current = ctx
      streamRef.current = stream
      analyserRef.current = analyser
      bufRef.current = new Float32Array(analyser.fftSize)
      hannRef.current = makeHannCoeffs(analyser.fftSize)
      emaHz.current = makeEMA(0.25, null)
      noiseFloorRef.current = 0

      setStatus(`Running @ ${ctx.sampleRate} Hz`)
      setRunning(true)
      rafRef.current = requestAnimationFrame(loop)
    } catch (e) {
      setStatus('Microphone failure: ' + e.message)
      setRunning(false)
    }
  }

  function stop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    try {
      streamRef.current?.getTracks?.().forEach(t => t.stop())
    } catch {}
    try { audioCtxRef.current?.close?.() } catch {}
    audioCtxRef.current = null
    analyserRef.current = null
    bufRef.current = null
    hannRef.current = null
    setRunning(false)
    setStatus('Idle')
  }

  useEffect(() => () => stop(), [])

  return (
    <section className='max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
      <header className='mb-4'>
        <h1 className='text-2xl font-bold'>Guitar Tuner</h1>
        <p className='text-gray-600'>Tune your guitar with your microphone. Auto detect or pick a string. Supports Standard and Drop D.</p>
      </header>

      <div className='bg-white border-2 border-black rounded-xl shadow-md p-4'>
        <TunerControls
          running={running}
          onStart={start}
          onStop={stop}
          a4={a4}
          setA4={setA4}
          mode={mode}
          setMode={setMode}
          preset={preset}
          setPreset={(p) => { setPreset(p); setStringIndex(0) }}
          stringIndex={stringIndex}
          setStringIndex={setStringIndex}
          showStrobe={showStrobe}
          setShowStrobe={setShowStrobe}
          presets={presets}
          status={status}
        />

        {/* Center display */}
        <div className='mt-6 flex flex-col items-center text-center'>
          <div className='text-7xl font-bold tracking-wide'>{noteText}</div>
          <div className='mt-2 text-lg text-gray-700'>{freq ? `${freq.toFixed(2)} Hz` : '0.00 Hz'}</div>
          <div className='mt-1 text-lg'>
            {cents >= 0 ? '+' : ''}{(cents || 0).toFixed(1)} cent
          </div>
          <TunerNeedle cents={cents} />
        </div>

        <TunerStrobe active={showStrobe} cents={cents} />

        {/* Strings row */}
        <section className='mt-6' aria-label='strings'>
          <ul className='flex flex-wrap items-center gap-2'>
            {presets[preset].map((n, i) => {
              const active = mode === 'target' ? i === stringIndex : i === autoStringIndex
              return (
                <li key={i}>
                  <button
                    type='button'
                    className={`px-3 py-2 rounded-lg border-2 border-black ${active ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'}`}
                    onClick={() => { setMode('target'); setStringIndex(i) }}
                    aria-pressed={active}
                    aria-label={`String ${i + 1} ${n}`}
                  >{n}</button>
                </li>
              )
            })}
          </ul>
          <p className='mt-2 text-xs text-gray-600'>Tap a string to lock target. In Auto mode the closest string is highlighted.</p>
        </section>

        <div className='mt-3 text-sm text-gray-600'>
          Tip: place the microphone near the 12th fret about 10–15 cm away.
        </div>
      </div>
    </section>
  )
}
