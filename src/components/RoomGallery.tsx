'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { HOTEL_NAME } from '@/lib/siteConfig'

const DRAG_THRESHOLD = 50
const IMAGE_SIZES = '(min-width: 1024px) 50vw, 100vw'

export default function RoomGallery({
  images,
  roomName,
  roomNumber,
}: {
  images: string[]
  roomName: string
  // Omitted by callers showing a room TYPE rather than one physical room
  // (e.g. the /rooms type-detail modal) — alt text drops the "Room X"
  // clause entirely in that case, rather than showing a blank/undefined
  // room number.
  roomNumber?: string
}) {
  const altSuffix = roomNumber ? ` — Room ${roomNumber} at ${HOTEL_NAME}` : ` at ${HOTEL_NAME}`
  const [active, setActive] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartX = useRef(0)

  // Fade between photos — adjusting state during render (React's
  // documented pattern for reacting to a state change without an extra
  // effect-triggered render), the same approach GalleryLightbox.tsx
  // already uses for its own photo crossfade: fade out the instant
  // `active` changes, swap the src while invisible, fade back in. The
  // effect below only ever calls setState inside its setTimeout callback,
  // never directly in the effect body.
  const [visible, setVisible] = useState(true)
  const [lastActive, setLastActive] = useState(active)
  if (active !== lastActive) {
    setLastActive(active)
    if (visible) setVisible(false)
  }
  useEffect(() => {
    if (visible) return
    const timeout = setTimeout(() => setVisible(true), 20)
    return () => clearTimeout(timeout)
  }, [visible])

  if (images.length === 0) {
    return (
      <div className="aspect-[4/3] w-full overflow-hidden rounded-sm bg-espresso/10">
        <div className="flex h-full w-full items-center justify-center text-xs tracking-widest text-espresso/40 uppercase">
          Photo coming soon
        </div>
      </div>
    )
  }

  // Wraps rather than clamps — navigating past the last photo loops back
  // to the first, and vice versa. The extra `+ images.length` before the
  // modulo handles `index` going negative (e.g. active 0, going "previous").
  const goTo = (index: number) => {
    setActive((index + images.length) % images.length)
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (images.length < 2) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    dragStartX.current = e.clientX
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    setIsDragging(false)
    const deltaX = e.clientX - dragStartX.current
    if (deltaX > DRAG_THRESHOLD) {
      goTo(active - 1)
    } else if (deltaX < -DRAG_THRESHOLD) {
      goTo(active + 1)
    }
  }

  const handlePointerCancel = () => {
    setIsDragging(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (images.length < 2) return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      goTo(active - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      goTo(active + 1)
    }
  }

  // Only the next photo forward — by far the most common navigation
  // (arrow click, swipe-left, right-arrow key) — is preloaded, not the
  // whole set, so a room with many photos doesn't fetch them all up
  // front. A real next/image (not a plain <img>), so it resolves through
  // the same optimizer/cache entry the visible <Image> below reuses the
  // instant it becomes active — hidden via CSS only, which doesn't affect
  // the browser's resource fetch (that's driven by the sizes/srcset
  // attributes, resolved independently of layout/display).
  const nextIndex = (active + 1) % images.length

  return (
    <div>
      <div
        role="group"
        aria-label={`${roomName} photo gallery`}
        tabIndex={images.length > 1 ? 0 : -1}
        className={`group relative aspect-[4/3] w-full touch-pan-y select-none overflow-hidden rounded-sm bg-espresso/10 outline-none focus-visible:ring-2 focus-visible:ring-brass/60 ${
          images.length > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerCancel}
        onKeyDown={handleKeyDown}
      >
        <Image
          key={images[active]}
          src={images[active]}
          alt={`${roomName}${altSuffix}, photo ${active + 1} of ${images.length}`}
          fill
          draggable={false}
          priority
          sizes={IMAGE_SIZES}
          className={`object-cover transition-opacity duration-200 ${
            visible ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {images.length > 1 && (
          <Image
            key={`preload-${images[nextIndex]}`}
            src={images[nextIndex]}
            alt=""
            aria-hidden="true"
            fill
            priority
            sizes={IMAGE_SIZES}
            className="hidden"
          />
        )}

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(active - 1)}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-charcoal/50 text-ivory opacity-100 transition-opacity hover:bg-charcoal/70 md:opacity-0 md:group-hover:opacity-100"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => goTo(active + 1)}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-charcoal/50 text-ivory opacity-100 transition-opacity hover:bg-charcoal/70 md:opacity-0 md:group-hover:opacity-100"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Small, understated position indicator — not a large or
                busy overlay, just enough to signal more photos exist. */}
            <span className="absolute bottom-3 right-3 rounded-full bg-charcoal/50 px-2.5 py-1 text-[11px] tracking-wide text-ivory">
              {active + 1} / {images.length}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
