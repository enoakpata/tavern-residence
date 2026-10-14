import Link from 'next/link'
import Image from 'next/image'
import { ArrowDown } from 'lucide-react'
import ScrollScene from '@/components/ScrollScene'
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
import './rooms.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `Rooms & Suites | ${HOTEL_NAME}`,
  description: `Browse Studio, 1-Bedroom, and Single rooms at ${HOTEL_NAME} in ${HOTEL_ADDRESS_LOCALITY}, ${HOTEL_ADDRESS_REGION} — from ₦90,000 to ₦200,000 per night, each with a king bed and kitchenette.`,
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
      // A representative physical room, only for its photos/price/specs —
      // its own room_number is never shown, only used to look up which
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
        // Real Rooms columns — never invented.
        maxOccupancy: representative.max_occupancy,
        bedType: representative.bed_type,
        isAvailable,
      }
    })
  )

  // Use a bedroom photo distinct from the homepage's lounge photo.
  const galleryImages = getGalleryImages()
  const heroImage = galleryImages[19] ?? galleryImages[0] ?? null

  return (
    <main className="rooms-page">
      <ScrollScene className="rooms-page-hero">
        {heroImage && (
          <Image
            src={heroImage}
            alt={`${HOTEL_NAME}, rooms and suites in Lekki Phase 1, Lagos`}
            fill
            priority
            sizes="100vw"
            className="rooms-hero-photo object-cover"
          />
        )}
        <div className="rooms-hero-shade" />
        <div className="rooms-hero-copy">
          <h1>Rooms and Suites</h1>
          <Link href="#rooms" className="outline-pill rooms-hero-link">
            Explore the collection <ArrowDown size={16} aria-hidden="true" />
          </Link>
        </div>
        <span className="rooms-hero-location">Lekki Phase 1, Lagos</span>

        {/* The exact homepage availability bar (HomeAvailabilityCheck's
            default "bar" variant, same DateRangePicker/GuestPicker) —
            reused as-is, not rebuilt, overlaid on the hero the same way
            the homepage's own hero-availability sits on its hero. The
            hero's own image/headline/button above are untouched; this is
            purely an added sibling. */}
        <div id="availability" className="hero-availability rooms-hero-availability">
          <HomeAvailabilityCheck
            key={`${rawCheckIn}-${rawCheckOut}`}
            initialCheckIn={hasDates ? rawCheckIn : null}
            initialCheckOut={hasDates ? rawCheckOut : null}
          />
        </div>
      </ScrollScene>

      {hasDates && (
        <div className="rooms-search-summary" role="status">
          <span>Availability for your selected dates</span>
          <span>{rawCheckIn} &ndash; {rawCheckOut}</span>
          <Link href="/rooms">Clear dates</Link>
        </div>
      )}
      {rows.length === 0 ? (
        <p className="rooms-empty-state">No rooms are listed yet. Check back shortly.</p>
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
    </main>
  )
}
