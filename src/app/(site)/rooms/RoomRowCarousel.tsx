'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { HOTEL_NAME } from '@/lib/siteConfig'

const DRAG_THRESHOLD = 50
const IMAGE_SIZES = '(min-width: 900px) 50vw, 100vw'

// Image side of a /rooms row — a dedicated carousel rather than reusing
// RoomGallery.tsx: that component crossfades between photos (see
// CrossfadeImage.tsx), but this brief specifically asks for a sliding
// transition, which would mean changing RoomGallery's own transition for
// its other two callers (rooms/[id], RoomTypeModal) too. Everything else
// (arrows, keyboard, swipe, counter, no captions/room numbers) mirrors
// RoomGallery's own established pattern.
export default function RoomRowCarousel({
  images,
  roomName,
}: {
  images: string[]
  roomName: string
}) {
  const [active, setActive] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartX = useRef(0)

  if (images.length === 0) {
    return (
      <div className="room-row-photo-empty">
        <span>Photo coming soon</span>
      </div>
    )
  }

  // Wraps rather than clamps, same as RoomGallery.tsx.
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
    if (deltaX > DRAG_THRESHOLD) goTo(active - 1)
    else if (deltaX < -DRAG_THRESHOLD) goTo(active + 1)
  }

  const handlePointerCancel = () => setIsDragging(false)

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

  return (
    <div
      role="group"
      aria-label={`${roomName} photo carousel`}
      tabIndex={images.length > 1 ? 0 : -1}
      className={`room-row-carousel group touch-pan-y select-none outline-none focus-visible:ring-2 focus-visible:ring-brass/60 ${
        images.length > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
      }`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
      onKeyDown={handleKeyDown}
    >
      <div
        className="room-row-carousel-track"
        style={{ transform: `translateX(-${active * 100}%)` }}
      >
        {images.map((src, index) => (
          <div className="room-row-carousel-slide" key={src}>
            <Image
              src={src}
              alt={`${roomName} at ${HOTEL_NAME}`}
              fill
              draggable={false}
              priority={index === 0}
              sizes={IMAGE_SIZES}
              className="object-cover"
            />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(active - 1)}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Previous photo"
            className="room-row-carousel-arrow previous opacity-100 md:opacity-0 md:group-hover:opacity-100"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Next photo"
            className="room-row-carousel-arrow next opacity-100 md:opacity-0 md:group-hover:opacity-100"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <span className="room-row-carousel-counter">
            {active + 1} / {images.length}
          </span>
        </>
      )}
    </div>
  )
}
