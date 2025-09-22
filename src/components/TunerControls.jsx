import React from 'react'

export default function TunerControls({
  running,
  onStart,
  onStop,
  a4,
  setA4,
  mode,
  setMode,
  preset,
  setPreset,
  stringIndex,
  setStringIndex,
  showStrobe,
  setShowStrobe,
  presets,
  status,
}) {
  const strings = presets[preset]
  return (
    <div className='flex flex-col gap-3'>
      {/* Top row: segmented Mode + Preset */}
      <div className='flex flex-wrap items-center gap-3'>
        <div className='inline-flex rounded-lg border-2 border-black overflow-hidden' role='tablist' aria-label='Mode'>
          <button
            className={`px-3 py-1 text-sm ${mode === 'auto' ? 'bg-black text-white' : 'bg-white text-black'} `}
            onClick={() => setMode('auto')}
            role='tab'
            aria-selected={mode === 'auto'}
          >Auto</button>
          <button
            className={`px-3 py-1 text-sm border-l-2 border-black ${mode === 'target' ? 'bg-black text-white' : 'bg-white text-black'} `}
            onClick={() => setMode('target')}
            role='tab'
            aria-selected={mode === 'target'}
          >Target</button>
        </div>

        <div className='inline-flex rounded-lg border-2 border-black overflow-hidden' role='tablist' aria-label='Preset'>
          {Object.keys(presets).map((p, idx) => (
            <button
              key={p}
              className={`px-3 py-1 text-sm ${idx ? 'border-l-2 border-black' : ''} ${preset === p ? 'bg-black text-white' : 'bg-white text-black'}`}
              onClick={() => setPreset(p)}
              role='tab'
              aria-selected={preset === p}
            >{p}</button>
          ))}
        </div>

        <label className='inline-flex items-center gap-2 text-sm ml-auto'>
          <span className='font-medium'>A4</span>
          <input
            type='number'
            inputMode='decimal'
            min='400'
            max='480'
            step='0.1'
            value={a4}
            onChange={(e) => setA4(Number(e.target.value) || 440)}
            className='w-24 bg-white border-2 border-black rounded-lg px-2 py-1 focus:outline-none'
            aria-label='A4 calibration'
          />
          <span>Hz</span>
        </label>
      </div>

      {/* Second row: Start/Stop + Strobe + Status */}
      <div className='flex flex-wrap items-center gap-3'>
        {!running ? (
          <button
            type='button'
            onClick={onStart}
            className='inline-flex items-center px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black'
            aria-label='Start listening'
          >Start</button>
        ) : (
          <button
            type='button'
            onClick={onStop}
            className='inline-flex items-center px-4 py-2 rounded-lg bg-white text-black border-2 border-black hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black'
            aria-label='Stop listening'
          >Stop</button>
        )}

        <label className='inline-flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            className='w-4 h-4 border-2 border-black rounded'
            checked={showStrobe}
            onChange={(e) => setShowStrobe(e.target.checked)}
          />
          <span>Strobe-like</span>
        </label>

        <span className='text-gray-600 text-sm'>{status}</span>
      </div>
    </div>
  )
}
