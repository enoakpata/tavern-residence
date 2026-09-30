'use client'

import { useState } from 'react'
import Image from 'next/image'
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

// 4 rows, one per type, thumbnail left / details middle / price+actions
// right on desktop — collapses to a stacked column per row on mobile.
// Replaces the earlier 2x2 card grid: with exactly 4 known types this
// reads as a tighter, more editorial list rather than a photo grid.
// "Book Now" carries the room TYPE + selected dates straight to the
// existing per-room booking flow (rooms/book/page.tsx resolves an actual
// available room server-side); "View Room" opens the same detail modal
// the old grid used, unchanged.
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
      <div className="mt-10 divide-y divide-charcoal/10 border-t border-charcoal/10">
        {rows.map((row) => {
          // Only actually blocks the row when we know it's unavailable —
          // with no dates picked yet, every type stays fully bookable.
          const isUnavailable = hasDates && !row.isAvailable

          // Book Now always carries a type, never a physical room id —
          // with no dates picked yet this lands on rooms/book without
          // checkin/checkout, which redirects straight back to /rooms
          // (see that route's own validation) so the guest picks dates
          // there instead, same as today's "pick dates on the room page"
          // fallback.
          const bookParams = new URLSearchParams({ type: row.content.dbName })
          if (checkIn) bookParams.set('checkin', checkIn)
          if (checkOut) bookParams.set('checkout', checkOut)
          if (adults) bookParams.set('adults', adults)
          if (childrenCount) bookParams.set('children', childrenCount)

          return (
            <div
              key={row.content.key}
              className={`flex flex-col gap-5 py-8 md:flex-row md:items-center md:gap-8 ${
                isUnavailable ? 'opacity-50' : ''
              }`}
            >
              <div className="relative h-48 w-full shrink-0 overflow-hidden rounded-sm bg-espresso/10 md:h-28 md:w-40">
                {row.coverImage ? (
                  <Image
                    src={row.coverImage}
                    alt={row.content.label}
                    fill
                    sizes="(min-width: 768px) 160px, 100vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs tracking-widest text-espresso/40 uppercase">
                    Photo coming soon
                  </div>
                )}
              </div>

              <div className="flex-1">
                <p className="text-xs tracking-widest text-brass uppercase">
                  {row.content.category}
                </p>
                <h3 className="mt-1 font-display text-2xl text-charcoal">
                  {row.content.label}
                </h3>
                {/* Icon + label spec line — compact amenity set, distinct
                    from the modal's fuller list, wrapping onto more than
                    one line on narrow viewports rather than truncating. */}
                <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  {row.content.rowAmenities.map((amenity) => {
                    const Icon = AMENITY_ICONS[amenity]
                    return (
                      <li
                        key={amenity}
                        className="flex items-center gap-1.5 text-xs text-charcoal/60"
                      >
                        {Icon && (
                          <Icon size={14} strokeWidth={1.5} className="shrink-0 text-espresso" />
                        )}
                        {amenity}
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div className="flex shrink-0 flex-row items-center justify-between gap-4 md:w-56 md:flex-col md:items-end">
                <div>
                  <p className="text-lg text-charcoal">From {row.priceLabel}</p>
                  <p className="text-xs text-charcoal/50">per night</p>
                </div>

                <div className="flex items-center gap-4">
                  {isUnavailable ? (
                    <span className="text-xs font-medium tracking-wide text-clay">
                      Unavailable for selected dates
                    </span>
                  ) : (
                    // Plain <a>, deliberately not next/link's <Link> — this
                    // points at rooms/book, a pure server-redirect route
                    // (see that file's own comment). A client-side <Link>
                    // transition into it got stuck on the intermediate
                    // /rooms/book URL instead of following through to the
                    // resolved /rooms/[id] (confirmed live: the server
                    // computed and served the right room, but the
                    // browser's own URL never advanced past /rooms/book).
                    // A plain anchor forces a real HTTP navigation, which
                    // correctly follows the server's 307 — proven via
                    // curl against every one of the 4 types.
                    <a
                      href={`/rooms/book?${bookParams.toString()}`}
                      className="rounded-full bg-espresso px-5 py-2.5 text-xs tracking-widest text-ivory uppercase transition-colors duration-base hover:bg-espresso/90"
                    >
                      Book Now
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpenKey(row.content.key)}
                    className="text-sm text-espresso underline-offset-4 hover:underline"
                  >
                    View Room
                  </button>
                </div>
              </div>
            </div>
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
