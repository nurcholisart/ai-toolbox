import React, { useEffect, useRef } from 'react'

// Simple strobe-like view: scrolling bars whose speed depends on cents offset
export default function TunerStrobe({ active = false, cents = 0 }) {
  const ref = useRef(null)
  const anim = useRef(0)
  const pos = useRef(0)

  useEffect(() => {
    if (!active) return () => {}
    const el = ref.current
    if (!el) return () => {}
    let last = performance.now()
    const tick = (t) => {
      const dt = Math.min(50, t - last)
      last = t
      // Speed ~ cents offset; direction by sign
      const speed = Math.max(-150, Math.min(150, cents * 3)) // px/s approx
      pos.current = (pos.current + (speed * dt) / 1000) % 40
      el.style.backgroundPosition = `${pos.current}px 0`
      anim.current = requestAnimationFrame(tick)
    }
    anim.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(anim.current)
  }, [active, cents])

  if (!active) return null

  return (
    <div
      ref={ref}
      className='mt-3 w-full max-w-xl h-8 border-2 border-black rounded-lg bg-[repeating-linear-gradient(90deg,_#000_0,_#000_2px,_#fff_2px,_#fff_20px)]'
      aria-label='strobe-like'
    />
  )
}

