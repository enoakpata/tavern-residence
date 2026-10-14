'use client'

import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import Reveal from '@/components/Reveal'
import type { RoomTypeContent, RoomTypeKey } from '@/lib/roomTypeContent'
import { AMENITY_ICONS } from '@/lib/amenityIcons'
import RoomRowCarousel from './RoomRowCarousel'
import RoomTypeModal from './RoomTypeModal'

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
  const [openKey, setOpenKey] = useState<RoomTypeKey | null>(null)
  const openRow = rows.find((r) => r.content.key === openKey) ?? null

  return (
    <>
      <div id="rooms" className="room-rows">
        {rows.map((row, index) => {
          const isUnavailable = hasDates && !row.isAvailable
          const images = row.galleryImages.length > 0 ? row.galleryImages : row.coverImage ? [row.coverImage] : []

          const bookParams = new URLSearchParams({ type: row.content.dbName })
          if (checkIn) bookParams.set('checkin', checkIn)
          if (checkOut) bookParams.set('checkout', checkOut)
          if (adults) bookParams.set('adults', adults)
          if (childrenCount) bookParams.set('children', childrenCount)

          return (
            <Reveal key={row.content.key} className={`room-row ${index % 2 === 1 ? 'room-row-reverse' : ''}`}>
              <div className="room-row-media">
                <RoomRowCarousel images={images} roomName={row.content.label} />
                {hasDates && (
                  <span className={`room-row-availability ${isUnavailable ? 'is-unavailable' : ''}`}>
                    {isUnavailable ? 'Unavailable for these dates' : 'Available for your dates'}
                  </span>
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
                  {isUnavailable ? (
                    <a href="#availability" className="room-row-book">Try other dates</a>
                  ) : (
                    // Plain <a>, not next/link's <Link> — the existing server
                    // redirect (rooms/book/page.tsx) needs a full navigation.
                    <a href={`/rooms/book?${bookParams.toString()}`} className="room-row-book">
                      Book now <ArrowUpRight size={16} aria-hidden="true" />
                    </a>
                  )}
                  <button type="button" onClick={() => setOpenKey(row.content.key)} className="room-row-more">
                    More details
                  </button>
                </div>
              </div>
            </Reveal>
          )
        })}
      </div>

      {openRow && (
        <RoomTypeModal
          content={openRow.content}
          images={openRow.galleryImages}
          priceLabel={openRow.priceLabel}
          checkIn={checkIn}
          checkOut={checkOut}
          adults={adults}
          childrenCount={childrenCount}
          isAvailable={!hasDates || openRow.isAvailable}
          onClose={() => setOpenKey(null)}
        />
      )}
    </>
  )
}
