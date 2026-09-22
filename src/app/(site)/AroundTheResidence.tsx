'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Reveal from '@/components/Reveal'
import GalleryLightbox from '@/components/GalleryLightbox'
import { GALLERY_IMAGE_GRADE } from '@/lib/galleryImageGrade'

// Placeholder captions standing in for real ones — swap these (and the
// images passed in from page.tsx) for the real, labeled shots whenever
// they exist. Not shown anywhere as visible UI (see the hover tiles and
// GalleryLightbox — no caption text renders in either); kept only as
// `alt` text, since accessibility labeling and "no text overlay" are
// separate concerns. Cycled with `%` against however many images
// actually arrive, so nothing breaks if that count isn't a multiple of
// this list's length.
const CAPTIONS = ['Lobby', 'Lounge', 'Hallway', 'Rooftop', 'Courtyard', 'Reception', 'Garden']

const PAGE_SIZE = 7

// Bento spans for each tile, in DOM order, unprefixed so they apply at
// every breakpoint — the grid itself goes from 2 columns (mobile) to 4
// (md+, see the container below), and a span like "col-span-2" scales
// with it automatically (half the grid on mobile, half on desktop too,
// just more columns to divide). Paired with `grid-flow-dense`, the
// browser packs each span into the next available gap on its own — one
// large feature tile, one tall, one wide, the rest square — without
// hand-placed grid-column/row coordinates that would break the moment a
// page's photo count changes (e.g. a final, partial page).
const TILE_SPANS = [
  'col-span-2 row-span-2',
  'col-span-1 row-span-1',
  'col-span-1 row-span-1',
  'col-span-1 row-span-2',
  'col-span-1 row-span-1',
  'col-span-2 row-span-1',
  'col-span-1 row-span-1',
]

// Swipe must clear this many px horizontally, and stay mostly horizontal
// (not a vertical scroll gesture), to count as a page-change swipe rather
// than the guest just scrolling the page past this section.
const SWIPE_THRESHOLD_PX = 50

export default function AroundTheResidence({ images }: { images: string[] }) {
  const photos = images.map((src, i) => ({ src, caption: CAPTIONS[i % CAPTIONS.length] }))

  const pageCount = Math.ceil(photos.length / PAGE_SIZE)
  const [pageIndex, setPageIndex] = useState(0)

  // Fade the current page out, swap its photos while invisible, fade the
  // new page in — adjusting state during render (React's documented
  // pattern for reacting to a prop/state change without an extra
  // effect-triggered render) is the same approach BookingForm.tsx already
  // uses for its own step-swap fade, and GalleryLightbox.tsx for its
  // photo crossfade. Kept as a horizontal offset alongside the opacity
  // fade (see the transform below) for a touch of the "slide" motion
  // without an actual sliding animation — still one calm, deliberate
  // fade, matching the rest of the site's motion.
  const [displayedPage, setDisplayedPage] = useState(0)
  const [contentVisible, setContentVisible] = useState(true)
  const [swapPending, setSwapPending] = useState(false)
  // Which edge the incoming page should feel like it's arriving from —
  // only affects the brief translate-x during the fade, not layout.
  const [swapDirection, setSwapDirection] = useState<1 | -1>(1)

  if (pageIndex !== displayedPage && !swapPending) {
    setContentVisible(false)
    setSwapPending(true)
  }

  useEffect(() => {
    if (!swapPending) return
    const timeout = setTimeout(() => {
      setDisplayedPage(pageIndex)
      setContentVisible(true)
      setSwapPending(false)
    }, 200)
    return () => clearTimeout(timeout)
  }, [swapPending, pageIndex])

  const touchStartX = useRef<number | null>(null)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (photos.length === 0) return null

  function goToPage(next: number) {
    const clamped = Math.max(0, Math.min(pageCount - 1, next))
    if (clamped === pageIndex) return
    setSwapDirection(clamped > pageIndex ? 1 : -1)
    setPageIndex(clamped)
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return
    // Swipe left (negative delta) moves forward, same direction a
    // left-swipe carries content on any horizontally-paginated surface.
    goToPage(deltaX < 0 ? pageIndex + 1 : pageIndex - 1)
  }

  const pagePhotos = photos.slice(displayedPage * PAGE_SIZE, displayedPage * PAGE_SIZE + PAGE_SIZE)
  const isFirstPage = pageIndex === 0
  const isLastPage = pageIndex === pageCount - 1

  return (
    <section className="section-py mx-auto max-w-6xl px-6 md:px-16">
      <p className="text-center text-xs tracking-widest text-brass uppercase">
        The Property
      </p>
      <h2 className="mt-3 text-center font-display text-3xl text-charcoal md:text-4xl">
        Around the Residence
      </h2>

      <Reveal className="relative mt-12 md:mt-16">
        {pageCount > 1 && (
          <button
            type="button"
            onClick={() => goToPage(pageIndex - 1)}
            aria-label="Previous photos"
            disabled={isFirstPage}
            className={`absolute left-0 top-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-charcoal/50 transition-opacity duration-base hover:text-charcoal ${
              isFirstPage ? 'pointer-events-none opacity-0' : 'opacity-100'
            }`}
          >
            <svg
              width="26"
              height="26"
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
        )}

        {pageCount > 1 && (
          <button
            type="button"
            onClick={() => goToPage(pageIndex + 1)}
            aria-label="Next photos"
            disabled={isLastPage}
            className={`absolute right-0 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 translate-x-1/2 items-center justify-center text-charcoal/50 transition-opacity duration-base hover:text-charcoal ${
              isLastPage ? 'pointer-events-none opacity-0' : 'opacity-100'
            }`}
          >
            <svg
              width="26"
              height="26"
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
        )}

        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={`grid grid-cols-2 auto-rows-[130px] grid-flow-dense gap-3 transition-[opacity,transform] duration-200 ease-out sm:auto-rows-[150px] md:grid-cols-4 md:auto-rows-[160px] md:gap-4 ${
            contentVisible
              ? 'translate-x-0 opacity-100'
              : `opacity-0 ${swapDirection === 1 ? '-translate-x-3' : 'translate-x-3'}`
          }`}
        >
          {pagePhotos.map((photo, index) => (
            <button
              key={photo.src}
              type="button"
              onClick={() => setOpenIndex(displayedPage * PAGE_SIZE + index)}
              aria-label={`View photo ${displayedPage * PAGE_SIZE + index + 1} of ${photos.length}`}
              className={`group relative overflow-hidden rounded-sm bg-verdant/10 ${TILE_SPANS[index % TILE_SPANS.length]}`}
            >
              <Image
                src={photo.src}
                alt={`${photo.caption} at Tavern Residence`}
                fill
                sizes="(min-width: 768px) 40vw, 75vw"
                className={`object-cover transition-transform duration-700 ease-out group-hover:scale-105 ${GALLERY_IMAGE_GRADE}`}
              />
            </button>
          ))}
        </div>
      </Reveal>

      {openIndex !== null && (
        <GalleryLightbox
          photos={photos}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
        />
      )}
    </section>
  )
}
