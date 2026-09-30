'use client'

import { useEffect } from 'react'
import RoomGallery from '@/components/RoomGallery'
import { AMENITY_ICONS } from '@/lib/amenityIcons'
import type { RoomTypeContent } from '@/lib/roomTypeContent'

// Room-TYPE detail modal — opened from a /rooms grid card instead of
// navigating to a per-physical-room page, since a card now represents
// every room sharing a type rather than one specific room. Reuses
// RoomGallery.tsx as-is (already has arrow nav + swipe, matching the
// site's established gallery interaction) and AMENITY_ICONS from the
// homepage's Our Rooms section, so this never re-implements either.
// Responsive per the brief: a bottom sheet on mobile (items-end, rounded
// top corners only), a centered max-width dialog on desktop.
export default function RoomTypeModal({
  content,
  images,
  priceLabel,
  checkIn,
  checkOut,
  adults,
  childrenCount,
  isAvailable,
  onClose,
}: {
  content: RoomTypeContent
  images: string[]
  priceLabel: string
  checkIn: string | null
  checkOut: string | null
  adults: string | null
  // Named childrenCount, not children — "children" is a reserved React
  // prop name and ESLint flags passing it as an ordinary prop.
  childrenCount: string | null
  isAvailable: boolean
  onClose: () => void
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Full-content modal (photos, full description, amenities), unlike
  // ConfirmModal's small dialog — a scrolling page behind it would be an
  // obvious distraction, same reasoning GalleryLightbox.tsx already uses.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  // Carries the room TYPE (its exact Rooms.name value, not a physical
  // room id) and the currently-selected dates through to the booking
  // resolver — see rooms/book/page.tsx, which picks one specific
  // available physical room of this type server-side before the guest
  // ever reaches the real booking form. Guest never sees or chooses a
  // room id at any point in this flow.
  const bookParams = new URLSearchParams({ type: content.dbName })
  if (checkIn) bookParams.set('checkin', checkIn)
  if (checkOut) bookParams.set('checkout', checkOut)
  if (adults) bookParams.set('adults', adults)
  if (childrenCount) bookParams.set('children', childrenCount)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/60 md:items-center md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={content.label}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-sm bg-white md:max-w-2xl md:rounded-sm">
        <div className="relative p-6 md:p-8">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-charcoal/60 shadow transition-colors hover:text-charcoal md:right-6 md:top-6"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            >
              <line x1="5" y1="5" x2="19" y2="19" />
              <line x1="19" y1="5" x2="5" y2="19" />
            </svg>
          </button>

          <RoomGallery images={images} roomName={content.label} />

          <p className="mt-6 text-xs tracking-widest text-brass uppercase">
            {content.category}
          </p>
          <h2 className="mt-2 font-display text-3xl text-charcoal">{content.label}</h2>
          <p className="mt-3 text-sm leading-relaxed text-charcoal/70">
            {content.longDescription}
          </p>

          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
            {content.amenities.map((amenity) => {
              const Icon = AMENITY_ICONS[amenity]
              return (
                <li key={amenity} className="flex items-center gap-2 text-xs text-charcoal/70">
                  {Icon && <Icon size={16} strokeWidth={1.5} className="shrink-0 text-espresso" />}
                  {amenity}
                </li>
              )
            })}
          </ul>

          <div className="mt-8 border-t border-charcoal/10 pt-6">
            <p className="text-lg text-charcoal">{priceLabel}</p>
            <p className="text-xs text-charcoal/50">per night</p>
          </div>

          {isAvailable ? (
            // Plain <a>, not next/link's <Link> — see the matching note in
            // RoomTypeList.tsx's own Book Now link for why: a client-side
            // transition into rooms/book (a pure server-redirect route)
            // got stuck on that intermediate URL instead of following the
            // server's redirect through to the resolved room.
            <a
              href={`/rooms/book?${bookParams.toString()}`}
              className="mt-4 block w-full rounded-sm bg-espresso py-4 text-center text-sm tracking-widest text-ivory uppercase transition-colors duration-base hover:bg-espresso/90"
            >
              Book This Room
            </a>
          ) : (
            <p className="mt-4 rounded-sm bg-charcoal/5 py-4 text-center text-sm text-charcoal/50">
              Unavailable for selected dates
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
