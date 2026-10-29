import Link from 'next/link'
import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import { isAnyRoomAvailable } from '@/lib/bookings'
import type { Room } from '@/lib/types'
import { getRoomCoverImage, getRoomGallery, getGalleryImages } from '@/lib/roomImages'
import { HOTEL_NAME, HOTEL_ADDRESS_LOCALITY, HOTEL_ADDRESS_REGION } from '@/lib/siteConfig'
import { todayInLagos } from '@/lib/dateUtils'
import { nightlyRate, promoOnDate } from '@/lib/pricing'
import { getPromotions } from '@/lib/promotions'
import { ROOM_TYPE_CONTENT, ROOM_TYPE_ORDER, type RoomTypeKey } from '@/lib/roomTypeContent'
import PageHero from '../PageHero'
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
  // here and on the homepage) so Book Now/Book This Room can pass them on
  // to /rooms/[id], and — below — so this page itself can filter by them.
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

  // The availability bar always submits adults alongside children (never
  // just one), so adults present is enough to treat this as "a guest
  // count was actually chosen" — independent of hasDates, since capacity
  // doesn't depend on which dates are picked, only on how many people.
  const DIGITS_PATTERN = /^\d+$/
  const adultsNum = adults !== null && DIGITS_PATTERN.test(adults) ? parseInt(adults, 10) : null
  const childrenNum =
    childrenCount !== null && DIGITS_PATTERN.test(childrenCount) ? parseInt(childrenCount, 10) : null
  const hasGuests = adultsNum !== null
  const requestedGuests = hasGuests ? (adultsNum ?? 0) + (childrenNum ?? 0) : null

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

  const promos = await getPromotions()

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

      // The rate for the guest's first night if they've chosen dates,
      // otherwise tonight's — so a promo price shows while it's running
      // and the normal price returns on its own once it ends.
      const rateDate = hasDates ? rawCheckIn : todayInLagos()
      const promo = promoOnDate(representative, rateDate, promos)

      return {
        content,
        coverImage: getRoomCoverImage(representative.room_number),
        galleryImages: getRoomGallery(representative.room_number).slice(
          0,
          MODAL_GALLERY_MAX_PHOTOS
        ),
        priceLabel: `₦${nightlyRate(representative, rateDate, promos).toLocaleString()}`,
        regularPriceLabel: promo ? `₦${promo.normalRate.toLocaleString()}` : null,
        promoLabel: promo?.label ?? null,
        // Real Rooms columns — never invented.
        maxOccupancy: representative.max_occupancy,
        bedType: representative.bed_type,
        isAvailable,
        // Capacity is independent of dates — every physical room sharing
        // this type has the same max_occupancy, so the representative's
        // value speaks for the whole type.
        isTooSmall: hasGuests && requestedGuests! > representative.max_occupancy,
      }
    })
  )

  // True only once a guest count was actually chosen and it's larger
  // than every room type's own capacity — i.e. no type, regardless of
  // dates, could ever hold that many people.
  const noRoomFitsGuestCount = hasGuests && rows.length > 0 && rows.every((row) => row.isTooSmall)

  // Use a bedroom photo distinct from the homepage's lounge photo.
  const galleryImages = getGalleryImages()
  const heroImage = galleryImages[19] ?? galleryImages[0] ?? null

  return (
    <main className="rooms-page">
      <PageHero
        image={heroImage ? { src: heroImage, alt: `${HOTEL_NAME}, rooms and suites in Lekki Phase 1, Lagos` } : null}
        title="Rooms and Suites"
        action={{ label: 'Explore the collection', href: '#rooms' }}
        initialCheckIn={hasDates ? rawCheckIn : null}
        initialCheckOut={hasDates ? rawCheckOut : null}
        scrollToRoomsOnComplete
      />

      {hasDates && (
        <div className="rooms-search-summary" role="status">
          <span>Availability for your selected dates</span>
          <span>{rawCheckIn} &ndash; {rawCheckOut}</span>
          <Link href="/rooms">Clear dates</Link>
        </div>
      )}
      {noRoomFitsGuestCount && (
        <div className="rooms-capacity-notice" role="status">
          For groups of {requestedGuests}, please contact us or book more than one room.
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
