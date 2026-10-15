'use client'

import { ArrowUpRight } from 'lucide-react'
import Reveal from '@/components/Reveal'
import type { RoomTypeContent } from '@/lib/roomTypeContent'
import { AMENITY_ICONS } from '@/lib/amenityIcons'
import RoomRowCarousel from './RoomRowCarousel'

export type RoomTypeRowData = {
  content: RoomTypeContent
  coverImage: string | null
  galleryImages: string[]
  priceLabel: string
  // Real Rooms columns off the representative room — never invented, for
  // the row's "Guests / Bed" detail line.
  maxOccupancy: number
  bedType: string
  // Only meaningful when hasDates is true — see below.
  isAvailable: boolean
  // Only meaningful when a guest count was actually chosen (see hasGuests
  // below) — true when the chosen party is larger than this type's own
  // max_occupancy, independent of whether the dates themselves are free.
  isTooSmall: boolean
}

// Full-width alternating rows (image carousel / text), rather than a
// card grid — row N's image goes left on odd rows, right on even rows
// (index 0 = row 1 = image left), purely a function of position in
// `rows`, which is already in the fixed display order (see
// roomTypeContent.ts's ROOM_TYPE_ORDER).
export default function RoomTypeList({
  rows,
  hasDates,
  checkIn,
  checkOut,
  adults,
  childrenCount,
}: {
  rows: RoomTypeRowData[]
  hasDates: boolean
  checkIn: string | null
  checkOut: string | null
  adults: string | null
  // Named childrenCount, not children — "children" is a reserved React
  // prop name and ESLint flags passing it as an ordinary prop.
  childrenCount: string | null
}) {
  return (
    <div id="rooms" className="room-rows">
        {rows.map((row, index) => {
          // Too-small takes priority — whether or not the type is also
          // sold out for these dates, the real blocker for this guest is
          // that it can never fit their party, regardless of dates.
          const isUnavailable = hasDates && !row.isAvailable
          const status: 'too-small' | 'sold-out' | 'available' = row.isTooSmall
            ? 'too-small'
            : isUnavailable
              ? 'sold-out'
              : 'available'
          const isBookable = status === 'available'
          const images = row.galleryImages.length > 0 ? row.galleryImages : row.coverImage ? [row.coverImage] : []

          const bookParams = new URLSearchParams({ type: row.content.dbName })
          if (checkIn) bookParams.set('checkin', checkIn)
          if (checkOut) bookParams.set('checkout', checkOut)
          if (adults) bookParams.set('adults', adults)
          if (childrenCount) bookParams.set('children', childrenCount)

          return (
            <Reveal
              key={row.content.key}
              className={`room-row ${index % 2 === 1 ? 'room-row-reverse' : ''} ${!isBookable ? 'room-row-disabled' : ''}`}
            >
              <div className="room-row-media">
                <RoomRowCarousel images={images} roomName={row.content.label} />
                {status === 'too-small' && (
                  <span className="room-row-availability is-unavailable">
                    Not available for no of guests
                  </span>
                )}
                {status === 'sold-out' && (
                  <span className="room-row-availability is-unavailable">
                    Not available for these dates
                  </span>
                )}
                {status === 'available' && hasDates && (
                  <span className="room-row-availability">Available for your dates</span>
                )}
              </div>

              <div className="room-row-text">
                <p className="room-row-eyebrow">{row.content.category}</p>
                <h3 className="room-row-name">{row.content.label}</h3>
                <p className="room-row-description">{row.content.longDescription}</p>
                <p className="room-row-price">
                  Starts from {row.priceLabel}<span> / night</span>
                </p>
                <ul className="room-row-facts">
                  <li>Up to {row.maxOccupancy} guest{row.maxOccupancy === 1 ? '' : 's'}</li>
                  <li>{row.bedType} bed</li>
                </ul>
                <ul className="room-row-amenities">
                  {row.content.amenities.map((amenity) => {
                    const Icon = AMENITY_ICONS[amenity]
                    return (
                      <li key={amenity}>
                        {Icon && <Icon size={16} strokeWidth={1.25} aria-hidden="true" />}
                        <span>{amenity}</span>
                      </li>
                    )
                  })}
                </ul>
                <div className="room-row-actions">
                  {isBookable ? (
                    // Plain <a>, not next/link's <Link> — the existing server
                    // redirect (rooms/book/page.tsx) needs a full navigation.
                    <a href={`/rooms/book?${bookParams.toString()}`} className="room-row-book">
                      Book now <ArrowUpRight size={16} aria-hidden="true" />
                    </a>
                  ) : (
                    <button type="button" disabled className="room-row-book room-row-book-disabled">
                      Book now
                    </button>
                  )}
                </div>
              </div>
            </Reveal>
          )
        })}
    </div>
  )
}
