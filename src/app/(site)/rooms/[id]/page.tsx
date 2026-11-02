import fs from 'fs'
import path from 'path'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import type { Room } from '@/lib/types'
import { HOTEL_NAME } from '@/lib/siteConfig'
import { todayInLagos } from '@/lib/dateUtils'
import { ACTIVE_BOOKING_STATUSES } from '@/lib/bookings'
import { displayRoomCategory, displayRoomName } from '@/lib/roomTypeContent'
import BookingForm from './BookingForm'
import { getPromotions } from '@/lib/promotions'
import RoomGallery from '@/components/RoomGallery'

const META_DESCRIPTION_LENGTH = 155
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function truncateForMeta(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1).trimEnd()}…`
}

/**
 * Dates carried over from the rooms listing page's date picker, via
 * ?checkin=&checkout= — only trusted if both are present, well-formed,
 * checkout is after checkin, AND check-in hasn't already passed (in the
 * hotel's own Lagos timezone, not the visitor's device clock) — a
 * bookmarked or shared link, or just an old tab left open, can easily
 * carry dates that have since slipped into the past. Otherwise the
 * calendar just starts empty like it always has.
 */
function parseInitialDates(searchParams: { [key: string]: string | string[] | undefined }): {
  checkIn: string | null
  checkOut: string | null
} {
  const checkIn = typeof searchParams.checkin === 'string' ? searchParams.checkin : ''
  const checkOut = typeof searchParams.checkout === 'string' ? searchParams.checkout : ''
  const valid =
    ISO_DATE_PATTERN.test(checkIn) &&
    ISO_DATE_PATTERN.test(checkOut) &&
    checkOut > checkIn &&
    checkIn >= todayInLagos()

  return valid ? { checkIn, checkOut } : { checkIn: null, checkOut: null }
}

const DIGITS_PATTERN = /^\d+$/

/**
 * Same adults+children parsing as the /rooms listing and the
 * /rooms/book type resolver — kept independent of parseInitialDates
 * since a guest count is meaningful on its own, dates or not. Returns
 * nulls (not 0) when nothing valid was present, so "no guest count was
 * chosen" stays distinguishable from "a party of 0".
 */
function parseGuestCount(searchParams: { [key: string]: string | string[] | undefined }): {
  adults: string | null
  childrenCount: string | null
  requestedGuests: number | null
} {
  const adults = typeof searchParams.adults === 'string' ? searchParams.adults : ''
  const childrenCount = typeof searchParams.children === 'string' ? searchParams.children : ''
  const adultsNum = DIGITS_PATTERN.test(adults) ? parseInt(adults, 10) : null
  const childrenNum = DIGITS_PATTERN.test(childrenCount) ? parseInt(childrenCount, 10) : null
  return {
    adults: adultsNum !== null ? adults : null,
    childrenCount: childrenNum !== null ? childrenCount : null,
    requestedGuests: adultsNum !== null ? adultsNum + (childrenNum ?? 0) : null,
  }
}

function getRoomImages(roomNumber: string): string[] {
  const folderPath = path.join(process.cwd(), 'public', 'images', roomNumber)
  const coverFileName = `room_${roomNumber}.jpg`

  let files: string[] = []
  try {
    files = fs.readdirSync(folderPath)
  } catch (err) {
    // Folder doesn't exist yet for this room — that's fine, the gallery
    console.log('Could not read folder:', folderPath, err)
    return []
  }
  // TEMP DEBUG — remove once photos are working
  console.log('Folder found:', folderPath, '— files:', files)

  const hasCover = files.includes(coverFileName)
  const rest = files.filter((f) => f !== coverFileName)
  const ordered = hasCover ? [coverFileName, ...rest] : files

  return ordered.map((f) => `/images/${roomNumber}/${f}`)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params

  const { data: room } = await supabase.from('Rooms').select('*').eq('id', id).single()

  if (!room) {
    return { title: `Room not found | ${HOTEL_NAME}` }
  }

  const r = room as Room
  const title = `${displayRoomName(r.name)} | ${HOTEL_NAME}`
  const description = truncateForMeta(r.description, META_DESCRIPTION_LENGTH)
  const coverImage = getRoomImages(r.room_number)[0]

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: coverImage ? [coverImage] : undefined,
    },
  }
}

export default async function RoomDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const { checkIn: initialCheckIn, checkOut: initialCheckOut } = parseInitialDates(resolvedSearchParams)
  const { adults, childrenCount, requestedGuests } = parseGuestCount(resolvedSearchParams)

  const { data: room, error } = await supabase
    .from('Rooms')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !room) {
    notFound()
  }

  const r = room as Room
  const images = getRoomImages(r.room_number)

  // Pull existing bookings for this room so the calendar can grey out
  // dates that are already taken — mirrors the same statuses that count
  // as "blocking" in the server-side availability check. Reads from the
  // booking_availability view rather than the Bookings table directly:
  // Bookings carries guest PII (names, phone numbers, payment tokens) and
  // its row-level security correctly blocks anonymous reads, which
  // silently returned zero rows here and made every date look free. The
  // view exposes only room_id/check_in/check_out/status and is the same
  // one isRoomAvailable() already relies on for the guest-facing
  // availability check.
  const { data: bookings } = await supabase
    .from('booking_availability')
    .select('check_in, check_out')
    .eq('room_id', id)
    .in('status', ACTIVE_BOOKING_STATUSES)

  // Promos priced into the form's live total — the same list
  // createBooking prices from, so the guest is charged what they saw.
  const promos = await getPromotions()

  const blockedRanges = (bookings ?? []).map((b) => ({
    checkIn: b.check_in as string,
    checkOut: b.check_out as string,
  }))

  const amenities = [
    'King bed',
    'Air conditioning',
    'Smart TV',
    'Iron',
    'Free Wi-Fi',
    'Ensuite bathroom with shower',
    r.has_kitchenette && 'Dry Kitchenette',
    r.has_living_area && 'Living area',
  ].filter(Boolean) as string[]

  return (
    <main className="mx-auto max-w-6xl px-6 py-16 md:px-12 md:py-24">
      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <RoomGallery images={images} roomName={displayRoomName(r.name)} />
        </div>

        <div>
          <p className="text-xs tracking-widest text-brass uppercase">
            {displayRoomCategory(r.room_type)} · {r.floor} floor
          </p>
          <h1 className="mt-3 font-display text-4xl text-charcoal">
            {displayRoomName(r.name)}
          </h1>
          <p className="mt-4 text-charcoal/70">{r.description}</p>

          <dl className="mt-8 grid grid-cols-2 gap-4 border-y border-charcoal/10 py-6 text-sm">
            <div>
              <dt className="text-charcoal/50">Max occupancy</dt>
              <dd className="mt-1 text-charcoal">{r.max_occupancy} guests</dd>
            </div>
            <div>
              <dt className="text-charcoal/50">Bed</dt>
              <dd className="mt-1 text-charcoal">{r.bed_type}</dd>
            </div>
            {r.room_size_sqm && (
              <div>
                <dt className="text-charcoal/50">Room size</dt>
                <dd className="mt-1 text-charcoal">{r.room_size_sqm} m²</dd>
              </div>
            )}
          </dl>

          <ul className="mt-6 grid grid-cols-2 gap-y-2 text-sm text-charcoal/70">
            {amenities.map((a) => (
              <li key={a} className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-brass" />
                {a}
              </li>
            ))}
          </ul>

          <div className="mt-10">
            {requestedGuests !== null && requestedGuests > r.max_occupancy ? (
              // Blocks the exact URL-tampering case the brief calls out:
              // a direct/edited link to a specific room with more guests
              // than it can hold. No form rendered at all — nothing to
              // tamper with or submit past this point.
              <div className="rounded-sm bg-charcoal/5 p-5 text-sm text-charcoal/70">
                This room sleeps up to {r.max_occupancy} guest{r.max_occupancy === 1 ? '' : 's'}, which
                isn&apos;t enough for a party of {requestedGuests}.{' '}
                <Link href="/rooms" className="text-espresso underline underline-offset-4">
                  See other rooms
                </Link>{' '}
                or contact us for groups larger than any single room.
              </div>
            ) : (
              <BookingForm
                room={r}
                promos={promos}
                blockedRanges={blockedRanges}
                initialCheckIn={initialCheckIn}
                initialCheckOut={initialCheckOut}
                adults={adults}
                childrenCount={childrenCount}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
