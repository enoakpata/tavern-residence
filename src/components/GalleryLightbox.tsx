'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { GALLERY_IMAGE_GRADE } from '@/lib/galleryImageGrade'

export type LightboxPhoto = { src: string; caption: string }

// Custom-built lightbox (no plugin) — dark, cinematic overlay for viewing
// the property photography full-bleed. Close/arrow controls are thin-line
// SVGs matching the header's own icon style (see Header.tsx's hamburger/
// close icon: stroke-only, round caps, no fill). Switching photos does a
// short opacity crossfade rather than a slide, mirroring the same
// fade-swap pattern BookingForm.tsx already uses for its own step
// transitions — nothing new invented for that motion.
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
  // Crossfade between photos (and the initial fade-in on open): adjusting
  // state during render — React's documented pattern for reacting to a
  // prop change without an extra effect-triggered render — the same one
  // BookingForm.tsx already uses for its own step-swap fade. This starts
  // the fade-out synchronously the moment `index` changes; the effect
  // below only ever calls setState inside its setTimeout callback, never
  // directly in the effect body.
  const [visible, setVisible] = useState(false)
  const [lastIndex, setLastIndex] = useState(index)

  if (index !== lastIndex) {
    setLastIndex(index)
    if (visible) setVisible(false)
  }

  useEffect(() => {
    if (visible) return
    const timeout = setTimeout(() => setVisible(true), 20)
    return () => clearTimeout(timeout)
  }, [visible])

  // Locks background scroll while the lightbox is open — a full-bleed
  // photo viewer, unlike ConfirmModal's small dialog, so a scrolling page
  // behind it would be an obvious distraction from the photo itself.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onNavigate((index + 1) % photos.length)
      if (e.key === 'ArrowLeft') onNavigate((index - 1 + photos.length) % photos.length)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [index, photos.length, onClose, onNavigate])

  const photo = photos[index]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/95 px-4 md:px-6"
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center text-ivory/80 transition-colors hover:text-ivory md:right-6 md:top-6"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <line x1="5" y1="5" x2="19" y2="19" />
          <line x1="19" y1="5" x2="5" y2="19" />
        </svg>
      </button>

      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => onNavigate((index - 1 + photos.length) % photos.length)}
            aria-label="Previous photo"
            className="absolute left-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-ivory/70 transition-colors hover:text-ivory md:left-6"
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
          <button
            type="button"
            onClick={() => onNavigate((index + 1) % photos.length)}
            aria-label="Next photo"
            className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-ivory/70 transition-colors hover:text-ivory md:right-6"
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
        </>
      )}

      <div
        className={`relative h-[65vh] w-full max-w-4xl transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <Image
          src={photo.src}
          alt={`${photo.caption} at Tavern Residence`}
          fill
          sizes="(min-width: 768px) 60vw, 90vw"
          className={`object-contain ${GALLERY_IMAGE_GRADE}`}
        />
      </div>
    </div>
  )
}
