'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

export type LightboxPhoto = { src: string; caption: string }

const SETTLE_MS = 280
const DRAG_THRESHOLD_PX = 60
// A quick flick covers less distance than DRAG_THRESHOLD_PX but moves
// fast — velocity (px/ms) catches that case too, so a short, fast swipe
// still advances instead of needing to travel the full threshold.
const FLICK_VELOCITY = 0.5

// Custom-built lightbox (no plugin) — dark, cinematic overlay for viewing
// the property photography full-bleed. Renders exactly 3 <Image> tags at
// a time (previous/current/next, wrapping at the ends) in a draggable
// flex track — swiping moves the track 1:1 with the finger and then
// settles with a CSS transition, the same mechanism arrow clicks and
// keyboard navigation animate through too, so every way of moving
// between photos feels consistent. Rendering only those 3 is also what
// "preload only the neighbouring images" means here: nothing else in the
// gallery is ever mounted, each of the 3 is `priority` (eager, not the
// lazy default), so the two the guest is about to swipe to are already
// loaded.
export default function GalleryLightbox({
  photos,
  index,
  onClose,
  onNavigate,
}: {
  photos: LightboxPhoto[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}) {
  const hasMultiple = photos.length > 1

  // Fade+scale-in on open only. prefers-reduced-motion isn't re-checked
  // in JS here — every current caller renders inside .guest-site, and
  // guest.css already forces `.guest-site *` transition-duration to
  // .01ms under that media query (see its own comment there), which
  // covers this and the drag-settle transition below without
  // duplicating the check per-component.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  // Locks background scroll while open, compensating for the scrollbar
  // that disappears when overflow is hidden — without this, the page
  // content (and the header) shifts right by the scrollbar's width the
  // instant the lightbox opens.
  useEffect(() => {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      const currentPaddingRight = parseFloat(getComputedStyle(document.body).paddingRight) || 0
      document.body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`
    }
    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
    }
  }, [])

  // Focus management: move focus into the dialog on open (the close
  // button), return it to whatever triggered the lightbox on close (the
  // clicked photo's own button, in every current caller), and trap Tab/
  // Shift+Tab within the dialog's own small set of focusable elements
  // while it's open — mirrors the same pattern Header.tsx's mobile menu
  // already uses.
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus())
    return () => {
      cancelAnimationFrame(frame)
      previouslyFocused.current?.focus?.({ preventScroll: true })
    }
    // Only ever runs once per mount — the lightbox is mounted/unmounted
    // by its parent (openIndex !== null), not re-rendered with a new
    // `index` in place, so this isn't re-triggered by navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'ArrowRight' && hasMultiple) settle('next')
      if (e.key === 'ArrowLeft' && hasMultiple) settle('prev')
      if (e.key === 'Tab') {
        const panel = dialogRef.current
        if (!panel) return
        const focusable = Array.from(
          panel.querySelectorAll<HTMLElement>('button')
        ).filter((el) => el.getClientRects().length > 0)
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, hasMultiple])

  // --- Drag-to-swipe: the track moves 1:1 with the pointer while
  // dragging (dragPercent, in % of the container's own width), then
  // animates the rest of the way to settle on next/prev/back-to-current.
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragPercent, setDragPercent] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const pointerState = useRef<{
    active: boolean
    startX: number
    startY: number
    lastX: number
    lastT: number
    velocity: number
    vertical: boolean
  }>({ active: false, startX: 0, startY: 0, lastX: 0, lastT: 0, velocity: 0, vertical: false })

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!hasMultiple || isAnimating) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    pointerState.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastT: e.timeStamp,
      velocity: 0,
      vertical: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const state = pointerState.current
    if (!state.active) return
    const dx = e.clientX - state.startX
    const dy = e.clientY - state.startY

    // Decide once, early, whether this gesture is vertical (a scroll/
    // flick attempt) rather than horizontal — only matters for not
    // visually dragging the track in response to a vertical gesture;
    // page scroll is already locked behind the overlay regardless.
    if (!state.vertical && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
      state.vertical = true
    }
    if (state.vertical) return

    const dt = e.timeStamp - state.lastT
    if (dt > 0) state.velocity = (e.clientX - state.lastX) / dt
    state.lastX = e.clientX
    state.lastT = e.timeStamp

    const width = containerRef.current?.offsetWidth || 1
    setDragPercent((dx / width) * 100)
  }

  function handlePointerUp() {
    const state = pointerState.current
    if (!state.active) return
    state.active = false
    if (state.vertical) {
      setDragPercent(0)
      return
    }
    const width = containerRef.current?.offsetWidth || 1
    const draggedPx = (dragPercent / 100) * width
    const isFlick = Math.abs(state.velocity) > FLICK_VELOCITY && Math.abs(draggedPx) > 10
    if (draggedPx > DRAG_THRESHOLD_PX || (isFlick && state.velocity > 0)) {
      settle('prev')
    } else if (draggedPx < -DRAG_THRESHOLD_PX || (isFlick && state.velocity < 0)) {
      settle('next')
    } else {
      settle('cancel')
    }
  }

  function settle(direction: 'next' | 'prev' | 'cancel') {
    // Guards every caller (pointer release, arrow click, keyboard) at
    // once — ignores a repeat trigger while a previous settle animation
    // is still in flight, rather than queueing overlapping timeouts that
    // could advance the index more than once per intended step.
    if (isAnimating) return
    if (direction === 'cancel') {
      setIsAnimating(true)
      setDragPercent(0)
      window.setTimeout(() => setIsAnimating(false), SETTLE_MS)
      return
    }
    setIsAnimating(true)
    setDragPercent(direction === 'next' ? -100 : 100)
    window.setTimeout(() => {
      onNavigate(
        direction === 'next' ? (index + 1) % photos.length : (index - 1 + photos.length) % photos.length
      )
      // Reset instantly (no transition) now that the new index's own
      // neighbours have been computed — visually identical to where the
      // settle animation just finished, so the swap is invisible.
      setIsAnimating(false)
      setDragPercent(0)
    }, SETTLE_MS)
  }

  const prevPhoto = photos[(index - 1 + photos.length) % photos.length]
  const currentPhoto = photos[index]
  const nextPhoto = photos[(index + 1) % photos.length]

  return (
    <div
      ref={dialogRef}
      className={`fixed inset-0 z-[110] flex items-center justify-center bg-charcoal/90 px-4 transition-opacity duration-200 md:px-6 ${
        mounted ? 'opacity-100' : 'opacity-0'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Photo gallery"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <button
        type="button"
        ref={closeButtonRef}
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-charcoal/40 text-ivory/90 transition-colors hover:bg-charcoal/60 hover:text-ivory md:right-6 md:top-6"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <line x1="5" y1="5" x2="19" y2="19" />
          <line x1="19" y1="5" x2="5" y2="19" />
        </svg>
      </button>

      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={() => settle('prev')}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-charcoal/40 text-ivory/90 transition-colors hover:bg-charcoal/60 hover:text-ivory md:left-6"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => settle('next')}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-charcoal/40 text-ivory/90 transition-colors hover:bg-charcoal/60 hover:text-ivory md:right-6"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      <div
        ref={containerRef}
        className={`relative h-[70vh] w-full max-w-5xl touch-pan-y select-none overflow-hidden transition-transform ${
          mounted ? 'scale-100' : 'scale-95'
        }`}
        style={{ transitionDuration: mounted ? undefined : '200ms' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="flex h-full"
          style={{
            width: '300%',
            transform: `translateX(calc(${-100 / 3}% + ${dragPercent / 3}%))`,
            transition: isAnimating ? `transform ${SETTLE_MS}ms ease-out` : 'none',
          }}
        >
          <LightboxSlide photo={hasMultiple ? prevPhoto : currentPhoto} />
          <LightboxSlide photo={currentPhoto} />
          <LightboxSlide photo={hasMultiple ? nextPhoto : currentPhoto} />
        </div>
      </div>

      {hasMultiple && (
        <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs tracking-wide text-ivory/70">
          {index + 1} / {photos.length}
        </p>
      )}
    </div>
  )
}

function LightboxSlide({ photo }: { photo: LightboxPhoto }) {
  return (
    <div className="relative h-full shrink-0" style={{ width: `${100 / 3}%` }}>
      <Image
        src={photo.src}
        alt={`${photo.caption} at Tavern Residence`}
        fill
        priority
        draggable={false}
        sizes="(min-width: 768px) 70vw, 94vw"
        className="object-contain"
      />
    </div>
  )
}
