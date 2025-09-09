import React from 'react'

export default function Toggle({ enabled, onChange, label }) {
  return (
    <button
      type='button'
      role='switch'
      aria-pressed={enabled}
      aria-label={label}
      onClick={() => onChange(!enabled)}
      className={`w-10 h-5 border-2 border-black rounded-full relative transition-colors focus:ring-2 focus:ring-black ${
        enabled ? 'bg-black' : 'bg-white'
      }`}
    >
      <span
        className={`block w-4 h-4 bg-white rounded-full absolute top-0.5 left-0.5 transition-transform ${
          enabled ? 'translate-x-5' : ''
        }`}
      />
    </button>
  )
}
