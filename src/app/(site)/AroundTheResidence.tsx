'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import CrossfadeImage from '@/components/CrossfadeImage'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import GalleryLightbox from '@/components/GalleryLightbox'

const DRAG_THRESHOLD = 50
// How far the whole trio visually "gives" while dragging, in px — a
// bounded, damped nudge (not a 1:1 follow all the way across) because
// there's nothing to reveal off-screen: this is a fixed 3-tile window
// whose photos crossfade in place, not a strip of adjacent slides, and
// dragging it further than this would just expose empty space behind
// it. Same role a rubber-band resistance limit plays in a real slide
// track — real-time feedback that you're dragging, without implying
// motion the layout can't actually show.
const MAX_DRAG_NUDGE_PX = 28
const SETTLE_MS = 300
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
  // Live visual feedback while dragging — see MAX_DRAG_NUDGE_PX above.
  // 0 whenever not actively dragging; the trio's own transform reads
  // straight off this, so drag, settle, and the plain "not dragging"
  // rest state are all the same mechanism rather than separate paths.
  const [dragOffsetPx, setDragOffsetPx] = useState(0)
  const dragStartX = useRef(0)
  // Which tile (by its absolute image index) the pointer actually went
  // down on — read in handlePointerDown, before setPointerCapture below
  // retargets every later event on this gesture (pointerup's own
  // e.target included) to the trio itself. Needed because that
  // retargeting also hits the native `click` event the browser fires
  // right after pointerup, so it never reaches a tile button's own
  // onClick — see handlePointerUp for how this stands in for it on a
  // tap/click (no real drag).
  const pressedTileIndex = useRef<number | null>(null)

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
    const tile = (e.target as HTMLElement).closest<HTMLElement>('[data-absolute-index]')
    pressedTileIndex.current = tile ? Number(tile.dataset.absoluteIndex) : null
    if (images.length < 2) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    dragStartX.current = e.clientX
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging) return
    const deltaX = e.clientX - dragStartX.current
    // Damped, not 1:1 — see MAX_DRAG_NUDGE_PX. tanh gives it a soft
    // rubber-band feel (near-linear for small movements, flattening out
    // well short of the cap) instead of a hard clamp that would suddenly
    // stop following the finger at all past the limit.
    setDragOffsetPx(MAX_DRAG_NUDGE_PX * Math.tanh(deltaX / (MAX_DRAG_NUDGE_PX * 2)))
  }
  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging) return
    setIsDragging(false)
    setDragOffsetPx(0)
    // Releasing capture here (rather than leaving it held until the
    // pointer naturally goes away) matters: with it still held, the
    // click event this same gesture is about to produce — the browser
    // always fires one right after pointerup/mouseup, even for a drag —
    // gets retargeted to whichever element called setPointerCapture
    // (this one) instead of hit-testing normally, so it never reaches a
    // tile's own onClick a few levels down. That silently ate every tap
    // on a photo, including plain clicks with no real drag at all.
    e.currentTarget.releasePointerCapture(e.pointerId)
    const deltaX = e.clientX - dragStartX.current
    if (deltaX > DRAG_THRESHOLD) {
      prev()
    } else if (deltaX < -DRAG_THRESHOLD) {
      next()
    } else if (pressedTileIndex.current !== null) {
      // Not a real drag — a tap/click. The native click event this
      // gesture produces can't be trusted to reach the tile's own
      // onClick (see pressedTileIndex's own comment), so this is what
      // actually opens the lightbox for a pointer-driven tap; the
      // button's onClick stays in place purely for keyboard activation
      // (Enter/Space), which never goes through pointer capture at all.
      setOpenIndex(pressedTileIndex.current)
    }
  }
  function handlePointerCancel(e: React.PointerEvent<HTMLDivElement>) {
    setIsDragging(false)
    setDragOffsetPx(0)
    e.currentTarget.releasePointerCapture(e.pointerId)
  }
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (images.length < 2) return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      prev()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      next()
    }
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
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerCancel}
        onKeyDown={handleKeyDown}
        style={{
          transform: dragOffsetPx ? `translateX(${dragOffsetPx}px)` : undefined,
          transition: isDragging ? 'none' : `transform ${SETTLE_MS}ms ease-out`,
        }}
      >
        {window_.map((absoluteIndex, slotIndex) => {
          const image = <CrossfadeImage src={images[absoluteIndex]} alt={'Interior detail ' + (absoluteIndex + 1) + ' at Tavern Residence'} fill draggable={false} sizes={slotIndex === 0 ? '(min-width: 768px) 37vw, 90vw' : '30vw'} className="object-cover" />
          const label = 'Enlarge residence photo ' + (absoluteIndex + 1)
          if (slotIndex === 0) {
            return <article className="residence-feature" key="feature"><button type="button" className="residence-feature-photo" data-absolute-index={absoluteIndex} onClick={() => setOpenIndex(absoluteIndex)} aria-label={label}>{image}</button></article>
          }
          return <button type="button" key={slotIndex === 1 ? 'secondary' : 'third'} className={slotIndex === 1 ? 'residence-secondary' : 'residence-third'} data-absolute-index={absoluteIndex} onClick={() => setOpenIndex(absoluteIndex)} aria-label={label}>{image}</button>
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
