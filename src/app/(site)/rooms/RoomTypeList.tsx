'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Users, BedDouble as BedIcon } from 'lucide-react'
import type { RoomTypeContent, RoomTypeKey } from '@/lib/roomTypeContent'
import { AMENITY_ICONS } from '@/lib/amenityIcons'
import RoomTypeModal from './RoomTypeModal'

export type RoomTypeRowData = {
  content: RoomTypeContent
  coverImage: string | null
  galleryImages: string[]
  priceLabel: string
  // Real Rooms.max_occupancy / bed_type off the representative room —
  // never invented. bed_type is currently "King" for every room, already
  // covered by the "King bed" entry in rowAmenities, so only occupancy
  // gets its own icon+label pairing here (see the capacity row below).
  maxOccupancy: number
  bedType: string
  // Only meaningful when hasDates is true — see below.
  isAvailable: boolean
}

// 4 rows, one per type, thumbnail left / details middle / price+actions
// right on desktop — collapses to a stacked column per row on mobile.
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
            // Calm, not bouncy — a soft background tint on the row and a
            // gentle zoom on its thumbnail, both on the same transition
            // duration the site uses everywhere else (duration-base).
            <div
              key={row.content.key}
              className={`group flex flex-col gap-5 rounded-sm px-3 py-8 transition-colors duration-base hover:bg-charcoal/[0.02] sm:-mx-3 md:flex-row md:items-center md:gap-8 ${
                isUnavailable ? 'opacity-50' : ''
              }`}
            >
              <div className="relative h-56 w-full shrink-0 overflow-hidden rounded-sm bg-espresso/10 sm:h-36 sm:w-36">
                {row.coverImage ? (
                  <Image
                    src={row.coverImage}
                    alt={row.content.label}
                    fill
                    sizes="(min-width: 640px) 144px, 100vw"
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
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
                <h3 className="mt-1 font-display text-2xl text-charcoal md:text-[26px]">
                  {row.content.label}
                </h3>

                {/* Capacity + bed type — small icon+label pairing, same
                    treatment as the amenity spec line below it but kept
                    as its own row since it's about the room's basic
                    specs rather than its amenities. */}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <span className="flex items-center gap-1.5 text-xs text-charcoal/70">
                    <Users size={14} strokeWidth={1.5} className="shrink-0 text-espresso" />
                    Up to {row.maxOccupancy} guest{row.maxOccupancy === 1 ? '' : 's'}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-charcoal/70">
                    <BedIcon size={14} strokeWidth={1.5} className="shrink-0 text-espresso" />
                    {row.bedType} bed
                  </span>
                </div>

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

              <div className="flex shrink-0 flex-row items-end justify-between gap-4 md:w-48 md:flex-col md:items-end">
                <div>
                  <p className="text-lg text-charcoal">From {row.priceLabel}</p>
                  <p className="text-xs text-charcoal/50">per night</p>
                </div>

                <div className="flex flex-col items-end gap-2">
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
                  {/* Secondary action, deliberately understated (smaller,
                      muted) so Book Now reads as the row's one primary
                      CTA — stacked beneath it rather than beside it. */}
                  <button
                    type="button"
                    onClick={() => setOpenKey(row.content.key)}
                    className="py-1 text-xs text-charcoal/50 underline-offset-4 hover:text-charcoal hover:underline"
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
