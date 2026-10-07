'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ArrowUpRight } from 'lucide-react'
import Reveal from '@/components/Reveal'
import type { RoomTypeContent, RoomTypeKey } from '@/lib/roomTypeContent'
import { AMENITY_ICONS } from '@/lib/amenityIcons'
import RoomTypeModal from './RoomTypeModal'

export type RoomTypeRowData = {
  content: RoomTypeContent
  coverImage: string | null
  galleryImages: string[]
  priceLabel: string
  // Only meaningful when hasDates is true — see below.
  isAvailable: boolean
}

// Photo cards preserve the existing type resolver, date parameters, and detail modal.
// Hover and keyboard focus reveal more detail; touch screens show it immediately.
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
      <div className="hotel-room-grid">
        {rows.map((row) => {
          // Only actually blocks the row when we know it's unavailable —
          // with no dates picked yet, every type stays fully bookable.
          const isUnavailable = hasDates && !row.isAvailable

          // Preserve the type and search parameters for the existing room resolver.
          const bookParams = new URLSearchParams({ type: row.content.dbName })
          if (checkIn) bookParams.set('checkin', checkIn)
          if (checkOut) bookParams.set('checkout', checkOut)
          if (adults) bookParams.set('adults', adults)
          if (childrenCount) bookParams.set('children', childrenCount)

          return (
            <Reveal key={row.content.key} className="hotel-room-reveal">
              <article className={`hotel-room-card ${isUnavailable ? 'room-unavailable' : ''}`} aria-labelledby={`room-title-${row.content.key}`}>
                <div className="hotel-room-photo-stage">
                  <button
                    type="button"
                    className="hotel-room-photo"
                    onClick={() => setOpenKey(row.content.key)}
                    aria-label={`View ${row.content.label} details and photos`}
                  >
                    {row.coverImage ? (
                      <Image
                        src={row.coverImage}
                        alt={row.content.label}
                        fill
                        sizes="(min-width: 900px) 550px, 100vw"
                        className="object-cover"
                      />
                    ) : (
                      <span className="hotel-room-photo-placeholder">Photo coming soon</span>
                    )}
                    <span className="hotel-room-photo-arrow"><ArrowUpRight size={24} aria-hidden="true" /></span>
                  </button>
                  {hasDates && <span className={`hotel-room-availability ${isUnavailable ? 'is-unavailable' : ''}`}>{isUnavailable ? 'Unavailable for these dates' : 'Available for your dates'}</span>}
                </div>

                <div className="hotel-room-copy">
                  <p className="hotel-room-category">{row.content.category}</p>
                  <h3 id={`room-title-${row.content.key}`} className="hotel-room-title">{row.content.label}</h3>
                  <p className="hotel-room-description">{row.content.longDescription.split('. ')[0]}.</p>
                  <div className="hotel-room-details">
                    <ul className="hotel-room-specs">
                      {row.content.rowAmenities.slice(0, 3).map((amenity) => {
                        const Icon = AMENITY_ICONS[amenity]
                        return (
                          <li key={amenity}>
                            {Icon && <Icon size={17} strokeWidth={1.25} aria-hidden="true" />}
                            <span>{amenity}</span>
                          </li>
                        )
                      })}
                    </ul>
                    <p className="hotel-room-price"><span>From</span> {row.priceLabel}<span>/ night</span></p>
                  </div>
                </div>

                <div className="hotel-room-actions">
                  <button type="button" onClick={() => setOpenKey(row.content.key)} className="hotel-room-view">
                    View room <ArrowUpRight size={16} aria-hidden="true" />
                  </button>
                  {isUnavailable ? (
                    <a href="#availability" className="hotel-room-change-dates">Try other dates</a>
                  ) : (
                    // Keep a full navigation: the existing server redirect needs a plain anchor.
                    <a href={`/rooms/book?${bookParams.toString()}`} className="hotel-room-book">
                      Book now <ArrowUpRight size={16} aria-hidden="true" />
                    </a>
                  )}
                </div>
              </article>
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
