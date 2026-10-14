'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import CrossfadeImage from '@/components/CrossfadeImage'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import GalleryLightbox from '@/components/GalleryLightbox'

const DRAG_THRESHOLD = 50
// Large tile + 2 small tiles, same staggered arrangement the former
// "Our Story" section used (.residence-feature/-secondary/-third in
// guest.css) — a fixed-position sliding window over `images`, not a
// scrollable track of pre-built groups: `current` is the large tile's
// index, and the two small tiles always show current+1/current+2
// (wrapping via modulo). Advancing moves `current` by exactly one, so
// only the image data swaps — the tiles themselves never move.
const VISIBLE_COUNT = 3

export default function AroundTheResidence({ images }: { images: string[] }) {
  const [current, setCurrent] = useState(0)
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartX = useRef(0)

  if (!images.length) return null

  const windowSize = Math.min(VISIBLE_COUNT, images.length)
  // Capped at `windowSize` (not always 3) so a gallery with fewer than 3
  // photos never repeats one in two tiles at once.
  const window_ = Array.from({ length: windowSize }, (_, k) => (current + k) % images.length)

  function next() {
    setCurrent((c) => (c + 1) % images.length)
  }
  function prev() {
    setCurrent((c) => (c - 1 + images.length) % images.length)
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (images.length < 2) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    dragStartX.current = e.clientX
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging) return
    setIsDragging(false)
    const deltaX = e.clientX - dragStartX.current
    if (deltaX > DRAG_THRESHOLD) prev()
    else if (deltaX < -DRAG_THRESHOLD) next()
  }
  function handlePointerCancel() {
    setIsDragging(false)
  }

  // Only the two images that would newly enter the window on the very
  // next step (either direction) are preloaded — not the whole gallery —
  // same reasoning as RoomGallery.tsx's own single-next-photo preload:
  // real next/image tags (hidden via CSS only, which doesn't affect the
  // browser's own resource fetch) so they're already cached the instant
  // they're needed.
  const preloadForward = images[(current + windowSize) % images.length]
  const preloadBackward = images[(current - 1 + images.length) % images.length]

  return <section id="gallery" className="home-section residence-gallery-section">
    <div className="editorial-heading"><p className="eyebrow">SPACE TO MAKE YOUR OWN</p><h2>Around the Residence</h2><p>Warm interiors, thoughtful details, and familiar comforts. Take a closer look at the spaces that make Tavern Residence a welcoming place for business trips, weekends away, and longer stays.</p><button className="quiet-button" onClick={() => setOpenIndex(current)}>Discover</button></div>
    <div className="residence-carousel">
      <div
        className={`residence-trio ${images.length > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''} touch-pan-y select-none`}
        role="group"
        aria-label="Residence photo gallery"
        tabIndex={images.length > 1 ? 0 : -1}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerCancel}
      >
        {window_.map((absoluteIndex, slotIndex) => {
          const image = <CrossfadeImage src={images[absoluteIndex]} alt={'Interior detail ' + (absoluteIndex + 1) + ' at Tavern Residence'} fill draggable={false} sizes={slotIndex === 0 ? '(min-width: 768px) 37vw, 90vw' : '30vw'} className="object-cover" />
          const label = 'Enlarge residence photo ' + (absoluteIndex + 1)
          if (slotIndex === 0) {
            return <article className="residence-feature" key="feature"><button type="button" className="residence-feature-photo" onClick={() => setOpenIndex(absoluteIndex)} aria-label={label}>{image}</button></article>
          }
          return <button type="button" key={slotIndex === 1 ? 'secondary' : 'third'} className={slotIndex === 1 ? 'residence-secondary' : 'residence-third'} onClick={() => setOpenIndex(absoluteIndex)} aria-label={label}>{image}</button>
        })}
      </div>
      {images.length > 1 && (
        <>
          <Image key={`preload-forward-${preloadForward}`} src={preloadForward} alt="" aria-hidden="true" fill priority sizes="30vw" className="hidden" />
          <Image key={`preload-backward-${preloadBackward}`} src={preloadBackward} alt="" aria-hidden="true" fill priority sizes="30vw" className="hidden" />
        </>
      )}
      {images.length > 1 && <><button className="slider-arrow previous" onClick={prev} aria-label="Previous residence photo"><ChevronLeft size={20} /></button><button className="slider-arrow next" onClick={next} aria-label="Next residence photo"><ChevronRight size={20} /></button></>}
    </div>
    <div className="gallery-pagination"><span>{String(current + 1).padStart(2, '0')}</span><div className="gallery-progress"><span style={{ width: ((current + 1) / images.length) * 100 + '%' }} /></div><span>{String(images.length).padStart(2, '0')}</span></div>
    {openIndex !== null && <GalleryLightbox photos={images.map(src => ({ src, caption: 'Residence interior' }))} index={openIndex} onClose={() => setOpenIndex(null)} onNavigate={setOpenIndex} />}
  </section>
}
