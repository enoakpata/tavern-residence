'use client'

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'

/** Supplies presentation-only scroll progress without intercepting native scrolling. */
export default function ScrollScene({
  children,
  className = '',
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let active = false
    function update() {
      frame = 0
      if (!element || preference.matches) return
      const rect = element.getBoundingClientRect()
      const progress = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / (rect.height + window.innerHeight)))
      element.style.setProperty('--scene-progress', String(progress))
    }
    function schedule() {
      if (active && !frame) frame = window.requestAnimationFrame(update)
    }
    const observer = new IntersectionObserver(([entry]) => {
      active = entry.isIntersecting
      if (active) schedule()
    }, { rootMargin: '150px' })
    observer.observe(element)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    preference.addEventListener('change', schedule)
    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      preference.removeEventListener('change', schedule)
    }
  }, [])

  return <div ref={ref} className={`scroll-scene ${className}`} style={style}>{children}</div>
}
