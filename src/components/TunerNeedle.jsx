import React from 'react'

export default function TunerNeedle({ cents = 0 }) {
  const clamped = Math.max(-50, Math.min(50, cents || 0))
  const left = 50 + clamped // -50..+50 => 0..100
  const markCls = 'absolute inset-y-0 w-px bg-gray-400'
  return (
    <div className='mt-4 w-full max-w-2xl'>
      <div className='relative h-4 bg-white border-2 border-black rounded-full overflow-hidden'>
        {/* major ticks */}
        <div className={`${markCls}`} style={{ left: '0%' }} />
        <div className={`${markCls}`} style={{ left: '25%' }} />
        <div className='absolute inset-y-0 w-px bg-black' style={{ left: '50%' }} />
        <div className={`${markCls}`} style={{ left: '75%' }} />
        <div className={`${markCls}`} style={{ left: '100%' }} />
        {/* center sweet-spot zone (~±3 cents) */}
        <div className='absolute top-0 bottom-0 -translate-x-1/2 bg-gray-200' style={{ left: '50%', width: '6%' }} />
        {/* needle */}
        <div className='absolute inset-y-0 w-0.5 bg-black' style={{ left: `${left}%` }} aria-hidden />
      </div>
      <div className='flex justify-between text-xs text-gray-700 mt-1'>
        <span>-50</span>
        <span>-25</span>
        <span>0</span>
        <span>+25</span>
        <span>+50</span>
      </div>
    </div>
  )
}
