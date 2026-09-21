'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

// Wraps a section so it fades + rises into place once it scrolls into
// view — the one calm, deliberate reveal motion used site-wide, rather
// than each section rolling its own. Plain IntersectionObserver + CSS
// transition (see .reveal in globals.css), not an animation library.
export default function Reveal({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          // Once revealed, stays revealed — no need to keep observing.
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={`reveal ${visible ? 'is-visible' : ''} ${className}`}>
      {children}
    </div>
  )
}
