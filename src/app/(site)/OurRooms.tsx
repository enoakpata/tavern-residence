'use client'

import { useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export type RoomCardData = {
  id: string
  label: string
  description: string
  priceFromLabel: string
  coverImage: string | null
}

const SCROLL_STEP = 280

// A row of the site's 4 real room types — uniform card size, no
// alternating layout. Always a horizontal `overflow-x-auto` scroller
// (snap-x) rather than switching to a static grid at a breakpoint: sized
// so the 4 cards comfortably fit within max-w-6xl on desktop (arrows are
// then effectively inert, nothing to scroll to), while genuinely
// overflowing — and needing the arrows — on narrower screens. Circular
// dark-green arrow buttons sit at the row's outer edges at every size,
// matching the reference (they're visible there on what's clearly a
// desktop screenshot, not a mobile-only affordance).
export default function OurRooms({ rooms }: { rooms: RoomCardData[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null)

  function scrollBy(direction: 1 | -1) {
    scrollerRef.current?.scrollBy({ left: direction * SCROLL_STEP, behavior: 'smooth' })
  }

  if (rooms.length === 0) return null

  return (
    <section className="section-py relative mx-auto max-w-6xl px-6 md:px-16">
      <p className="text-center text-xs tracking-widest text-stone uppercase">
        Our Rooms
      </p>
      <h2 className="mt-3 text-center font-display text-3xl text-charcoal md:text-4xl">
        Designed for comfort. <span className="italic">Curated for your stay.</span>
      </h2>

      {rooms.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Previous rooms"
            className="absolute top-[58%] left-0 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-verdant text-white shadow-lg transition-colors duration-base hover:bg-verdant/90 md:left-2"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Next rooms"
            className="absolute top-[58%] right-0 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-verdant text-white shadow-lg transition-colors duration-base hover:bg-verdant/90 md:right-2"
          >
            →
          </button>
        </>
      )}

      <div
        ref={scrollerRef}
        className="mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {rooms.map((room) => (
          <Link
            key={room.id}
            href={`/rooms/${room.id}`}
            className="group w-[78vw] max-w-72 flex-shrink-0 snap-start sm:w-64"
          >
            <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-verdant/10">
              {room.coverImage ? (
                <Image
                  src={room.coverImage}
                  alt={room.label}
                  fill
                  sizes="256px"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs tracking-widest text-verdant/40 uppercase">
                  Photo coming soon
                </div>
              )}
            </div>
            <h3 className="mt-4 font-display text-xl text-charcoal">{room.label}</h3>
            <p className="mt-1 text-sm text-stone">{room.description}</p>
            <p className="mt-2 text-xs tracking-widest text-charcoal/70 uppercase">
              {room.priceFromLabel}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
