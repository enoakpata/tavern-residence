'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'

const DRAG_THRESHOLD = 50

// A more editorial, immersive take on RoomGallery.tsx's interaction
// pattern (same drag/swipe, arrow buttons, and all-images-preloaded
// approach) for the homepage's mood-setting "Around the residence"
// section — a wider, more generous image and a slim filmstrip instead of
// RoomGallery's boxy thumbnail grid, since this can have dozens of
// photos where a room only ever has a handful.
export default function AmbientGallery({
  images,
  alt,
}: {
  images: string[]
  alt: string
}) {
  const [active, setActive] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartX = useRef(0)

  if (images.length === 0) {
    return (
      <div className="aspect-[4/3] w-full overflow-hidden rounded-sm bg-verdant/10 sm:aspect-[16/9]">
        <div className="flex h-full w-full items-center justify-center text-xs tracking-widest text-verdant/40 uppercase">
          Photo coming soon
        </div>
      </div>
    )
  }

  const goTo = (index: number) => {
    setActive(Math.min(Math.max(index, 0), images.length - 1))
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

  return (
    <div>
      <div
        role="group"
        aria-label={`${alt} photo gallery`}
        tabIndex={images.length > 1 ? 0 : -1}
        className={`group relative aspect-[4/3] w-full touch-pan-y select-none overflow-hidden rounded-sm bg-verdant/10 outline-none focus-visible:ring-2 focus-visible:ring-brass/60 sm:aspect-[16/9] ${
          images.length > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerCancel}
        onKeyDown={handleKeyDown}
      >
        {/* All photos are rendered and preloaded up front, stacked via
            `fill` and crossfaded on a slower, softer opacity transition
            than RoomGallery's snappier one — a more deliberate, ambient
            feel for this editorial homepage treatment rather than an
            instant swap. */}
        {images.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt={`${alt}, photo ${i + 1} of ${images.length}`}
            fill
            draggable={false}
            priority
            sizes="100vw"
            className={`object-cover transition-opacity duration-700 ease-in-out ${
              i === active ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          />
        ))}

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(active - 1)}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={active === 0}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-charcoal/50 text-lg text-ivory opacity-100 transition-opacity hover:bg-charcoal/70 disabled:opacity-30 md:opacity-0 md:group-hover:opacity-100"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => goTo(active + 1)}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={active === images.length - 1}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-charcoal/50 text-lg text-ivory opacity-100 transition-opacity hover:bg-charcoal/70 disabled:opacity-30 md:opacity-0 md:group-hover:opacity-100"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Slim, low-profile filmstrip rather than a grid of squares —
          scales far better than a fixed-column grid for a set that can
          run into the dozens, and reads lighter/more editorial. */}
      {images.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to photo ${i + 1}`}
              className={`relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-sm transition-opacity sm:h-16 sm:w-16 ${
                i === active ? 'opacity-100 ring-1 ring-brass' : 'opacity-50 hover:opacity-80'
              }`}
            >
              <Image
                src={img}
                alt={`${alt}, photo ${i + 1} of ${images.length}`}
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
