import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import { isAnyRoomAvailable } from '@/lib/bookings'
import type { Room } from '@/lib/types'
import { getRoomCoverImage, getRoomGallery, getGalleryImages } from '@/lib/roomImages'
import { HOTEL_NAME, HOTEL_ADDRESS_LOCALITY, HOTEL_ADDRESS_REGION } from '@/lib/siteConfig'
import { todayInLagos } from '@/lib/dateUtils'
import { ROOM_TYPE_CONTENT, ROOM_TYPE_ORDER, type RoomTypeKey } from '@/lib/roomTypeContent'
import HomeAvailabilityCheck from '../HomeAvailabilityCheck'
import RoomTypeList, { type RoomTypeRowData } from './RoomTypeList'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `Rooms & Suites | ${HOTEL_NAME}`,
  description: `Browse Studio, 1-Bedroom, and Standard rooms at ${HOTEL_NAME} in ${HOTEL_ADDRESS_LOCALITY}, ${HOTEL_ADDRESS_REGION} — from ₦90,000 to ₦200,000 per night, each with a king bed and kitchenette.`,
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MODAL_GALLERY_MAX_PHOTOS = 5

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const rawCheckIn = typeof params.checkin === 'string' ? params.checkin : ''
  const rawCheckOut = typeof params.checkout === 'string' ? params.checkout : ''
  // Carried along from the availability bar (HomeAvailabilityCheck, both
  // here and on the homepage) purely so Book Now/Book This Room can pass
  // them on to /rooms/[id] — nothing on this page filters by them, same
  // as before this was wired up.
  const adults = typeof params.adults === 'string' ? params.adults : null
  // Named childrenCount, not children — "children" is a reserved React
  // prop name (the JSX content between tags), and ESLint flags passing it
  // as an ordinary prop even when, as here, it's just a guest count.
  const childrenCount = typeof params.children === 'string' ? params.children : null
  // A bookmarked or shared link (or just an old tab left open) can carry
  // dates that have since passed — checked against the hotel's own Lagos
  // "today", not the visitor's device clock, same as elsewhere this is
  // validated. A stale check-in is treated the same as no dates at all.
  const hasDates =
    ISO_DATE_PATTERN.test(rawCheckIn) &&
    ISO_DATE_PATTERN.test(rawCheckOut) &&
    rawCheckOut > rawCheckIn &&
    rawCheckIn >= todayInLagos()

  const { data: rooms, error } = await supabase
    .from('Rooms')
    .select('*')
    .order('room_number', { ascending: true })

  if (error) {
    console.error(error)
    return (
      <main className="mx-auto max-w-6xl px-6 py-24 md:px-12">
        <p className="text-charcoal/70">
          We couldn't load rooms right now. Please try again shortly.
        </p>
      </main>
    )
  }

  const roomList = (rooms ?? []) as Room[]
  roomList.sort((a, b) => Number(a.room_number) - Number(b.room_number))

  // Group every physical room by TYPE (its Rooms.name — see
  // roomTypeContent.ts for why that's the grouping key rather than the
  // room_type column, which is too coarse to tell a Deluxe from a Suite).
  // A guest never sees room_number or any other per-instance identifier
  // from here on — only the 4 type-level rows built below.
  const roomsByTypeKey = new Map<RoomTypeKey, Room[]>()
  for (const room of roomList) {
    const typeKey = ROOM_TYPE_ORDER.find((key) => ROOM_TYPE_CONTENT[key].dbName === room.name)
    if (!typeKey) continue // a room whose name doesn't match any of the 4 known types — skip rather than guess
    const existing = roomsByTypeKey.get(typeKey)
    if (existing) existing.push(room)
    else roomsByTypeKey.set(typeKey, [room])
  }

  const rows: RoomTypeRowData[] = await Promise.all(
    ROOM_TYPE_ORDER.filter((key) => roomsByTypeKey.has(key)).map(async (key) => {
      const content = ROOM_TYPE_CONTENT[key]
      const physicalRooms = roomsByTypeKey.get(key)!
      const roomIds = physicalRooms.map((r) => r.id)
      // A representative physical room, only for its photos/price — its
      // own room_number is never shown, only used to look up which
      // image folder (public/images/<room_number>/) belongs to this type.
      const representative =
        physicalRooms.find((r) => r.room_number === content.representativeRoomNumber) ??
        physicalRooms[0]

      // "At least one of every physical room sharing this type" — see
      // isAnyRoomAvailable's own doc comment in lib/bookings.ts. Only
      // checked once dates are actually selected.
      const isAvailable = hasDates
        ? await isAnyRoomAvailable(roomIds, rawCheckIn, rawCheckOut)
        : true

      return {
        content,
        coverImage: getRoomCoverImage(representative.room_number),
        galleryImages: getRoomGallery(representative.room_number).slice(
          0,
          MODAL_GALLERY_MAX_PHOTOS
        ),
        priceLabel: `₦${representative.price_per_night.toLocaleString()}`,
        isAvailable,
      }
    })
  )

  // A different photo than the homepage hero's own galleryImages[0], so
  // the two full-bleed heroes don't look identical back to back — same
  // treatment (full-bleed, object-cover, diagonal dark-to-transparent
  // overlay), different shot.
  const galleryImages = getGalleryImages()
  const heroImage = galleryImages[1] ?? galleryImages[0] ?? null

  return (
    <main>
      {/* Hero — same full-bleed photo treatment as the homepage's
          (page.tsx): diagonal dark-to-transparent overlay, left-aligned
          content column. -mt-14/-mt-16 cancels the fixed header's own
          h-14/h-16 (see Header.tsx and (site)/layout.tsx's matching
          pt-14/pt-16) so the photo reaches the literal top of the
          viewport with no gap — Header.tsx's own `hasHero` check now
          includes /rooms specifically so it floats transparently over
          this, not just the homepage's. Shorter than the homepage's full
          h-screen — this is a secondary page, not the guest's first
          landing moment, so it doesn't need the same full-viewport
          presence. */}
      <section className="relative -mt-14 flex h-[70vh] min-h-[480px] items-center overflow-hidden px-6 text-white md:-mt-16 md:h-[75vh] md:px-16">
        {heroImage && (
          <Image
            src={heroImage}
            alt={`${HOTEL_NAME} — rooms and suites in Lekki Phase 1, Lagos`}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-charcoal/85 via-charcoal/40 to-transparent" />

        <div className="relative max-w-xl">
          <p className="text-xs tracking-widest text-brass uppercase">Accommodation</p>
          <h1 className="mt-4 font-display text-display-md leading-tight md:text-display-lg">
            Our Rooms
          </h1>
          <p className="mt-5 text-sm text-white/80">
            Considered comfort, in four distinct forms — from an intimate
            studio to our most complete suite.
          </p>
          {/* Generic — not tied to a type, so this scrolls to the room
              list below rather than the /rooms/book resolver, which
              needs a specific type to do anything useful. Each row's own
              Book Now (and the modal's) carries a real type. */}
          <Link
            href="#rooms"
            className="mt-8 inline-block rounded-full border border-brass px-6 py-3 text-xs tracking-widest uppercase transition-colors duration-base hover:bg-brass/10"
          >
            Book Now
          </Link>
        </div>
      </section>

      {/* Availability bar — a separate, minimal section, not layered
          over the hero. Same exact Check-in/Check-out/Guests/Check
          Availability component the homepage's own hero uses
          (HomeAvailabilityCheck.tsx) — it already targets /rooms with
          its results, so reusing it here just refreshes this same page's
          own query params instead of navigating elsewhere. */}
      <section className="mx-auto max-w-6xl px-6 py-8 md:px-12 md:py-10">
        <HomeAvailabilityCheck
          initialCheckIn={hasDates ? rawCheckIn : null}
          initialCheckOut={hasDates ? rawCheckOut : null}
        />
      </section>

      <section id="rooms" className="mx-auto max-w-6xl scroll-mt-20 px-6 pb-16 md:px-12 md:pb-24">
        <p className="text-xs tracking-widest text-brass uppercase">The Collection</p>
        <h2 className="mt-3 font-display text-3xl text-charcoal md:text-4xl">
          Every room, considered.
        </h2>

        {rows.length === 0 ? (
          <p className="mt-16 text-charcoal/60">
            No rooms are listed yet. Check back shortly.
          </p>
        ) : (
          <RoomTypeList
            rows={rows}
            hasDates={hasDates}
            checkIn={hasDates ? rawCheckIn : null}
            checkOut={hasDates ? rawCheckOut : null}
            adults={adults}
            childrenCount={childrenCount}
          />
        )}
      </section>
    </main>
  )
}
