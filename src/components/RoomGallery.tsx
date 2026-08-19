'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'

const DRAG_THRESHOLD = 50

export default function RoomGallery({
  images,
  roomName,
  roomNumber,
}: {
  images: string[]
  roomName: string
  roomNumber: string
}) {
  const [active, setActive] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartX = useRef(0)

  if (images.length === 0) {
    return (
      <div className="aspect-[4/3] w-full overflow-hidden rounded-sm bg-verdant/10">
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

  return (
    <div>
      <div
        className={`group relative aspect-[4/3] w-full touch-pan-y select-none overflow-hidden rounded-sm bg-verdant/10 ${
          images.length > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerCancel}
      >
        <Image
          src={images[active]}
          alt={`${roomName} — Room ${roomNumber} at Tavern Residence, photo ${active + 1} of ${images.length}`}
          fill
          draggable={false}
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(active - 1)}
              disabled={active === 0}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-charcoal/50 text-lg text-ivory opacity-100 transition-opacity hover:bg-charcoal/70 disabled:opacity-30 md:opacity-0 md:group-hover:opacity-100"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => goTo(active + 1)}
              disabled={active === images.length - 1}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-charcoal/50 text-lg text-ivory opacity-100 transition-opacity hover:bg-charcoal/70 disabled:opacity-30 md:opacity-0 md:group-hover:opacity-100"
            >
              ›
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="mt-4 grid grid-cols-4 gap-4">
          {images.map((img, i) => (
            <button
              key={img}
              type="button"
              onClick={() => setActive(i)}
              className={`relative aspect-square w-full overflow-hidden rounded-sm transition-opacity ${
                i === active
                  ? 'opacity-100 ring-2 ring-verdant ring-offset-2'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              <Image
                src={img}
                alt={`${roomName} — Room ${roomNumber} at Tavern Residence, photo ${i + 1} of ${images.length}`}
                fill
                sizes="(min-width: 1024px) 12vw, 25vw"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
