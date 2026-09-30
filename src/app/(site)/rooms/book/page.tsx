import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { resolveAvailableRoomId } from '@/lib/bookings'
import { todayInLagos } from '@/lib/dateUtils'

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * Resolves a room TYPE (+ optional dates) — carried here from /rooms's
 * row list (RoomTypeList.tsx's "Book Now") or the type-detail modal's
 * "Book This Room" (RoomTypeModal.tsx) — into one specific physical room,
 * entirely server-side, then redirects into the existing, unmodified
 * per-room booking page and its whole flow (rooms/[id]/page.tsx,
 * BookingForm.tsx, createBooking()). The guest never sees or picks a room
 * id at any point — only ever a type, both here and on every page before
 * it.
 *
 * Two cases, both keyed only on whether dates were actually selected:
 *  - Dates selected: picks a room of this type that's actually free for
 *    them (resolveAvailableRoomId) — if none are, bounces back to the
 *    listing rather than a dead booking page for a sold-out type.
 *  - No dates yet: just the first physical room of this type by
 *    room_number — there's nothing to check availability against, and
 *    the destination booking page (BookingForm.tsx) already lets the
 *    guest pick dates there, same as it always has for a direct room
 *    link. No fallback-to-listing case here: an existing type with at
 *    least one physical room always has a "first" one.
 *
 * IMPORTANT: both of those callers must link here with a plain <a>, not
 * next/link's <Link>. A client-side <Link> transition into this route was
 * confirmed (live, with the dev server's own terminal open) to get stuck
 * on this intermediate /rooms/book URL — the server-side redirect below
 * still ran and resolved correctly, but the browser's own location never
 * advanced to it. A real full-page navigation (plain <a>, or typing/
 * curling the URL directly) follows the 307 correctly every time. If a
 * future edit swaps either caller back to <Link>, this will silently
 * regress into the exact "Book Now does nothing" bug this fixed.
 *
 * Deliberately resolves here, at click-through, rather than inside
 * createBooking() at the literal final insert: that keeps the entire
 * proven booking/payment pipeline completely untouched, and (in the
 * dates-selected case) the room this redirects to is re-verified again
 * anyway right before it's actually booked (createBooking()'s own
 * existing re-check), which already has a full "no longer available"
 * fallback UX built in — so a room getting sniped in the gap between this
 * redirect and payment completing is handled exactly like today, no new
 * failure mode introduced.
 *
 * No page/UI here — this route only ever redirects.
 */
export default async function BookRoomTypePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const type = typeof params.type === 'string' ? params.type : ''
  const checkIn = typeof params.checkin === 'string' ? params.checkin : ''
  const checkOut = typeof params.checkout === 'string' ? params.checkout : ''
  // Carried through untouched to the resolved room page — nothing here
  // (or on /rooms/[id]) reads these yet, same as the homepage's own
  // availability bar already passing them to /rooms without anything
  // there filtering by them either. Not required for a valid request;
  // just passed along if present so they're never silently dropped.
  const adults = typeof params.adults === 'string' ? params.adults : ''
  const children = typeof params.children === 'string' ? params.children : ''

  const guestParams = new URLSearchParams()
  if (adults) guestParams.set('adults', adults)
  if (children) guestParams.set('children', children)

  if (!type) {
    // No type at all — nothing to resolve, not even "first room of type".
    const query = guestParams.toString()
    redirect(query ? `/rooms?${query}` : '/rooms')
  }

  const { data: rooms } = await supabase
    .from('Rooms')
    .select('id, room_number')
    .eq('name', type)
    .order('room_number', { ascending: true })

  const roomIds = (rooms ?? []).map((room) => room.id as string)

  const hasValidDates =
    ISO_DATE_PATTERN.test(checkIn) &&
    ISO_DATE_PATTERN.test(checkOut) &&
    checkOut > checkIn &&
    checkIn >= todayInLagos()

  if (!hasValidDates) {
    // No dates picked yet — no availability to check against, so just the
    // first physical room of this type. The destination booking page's
    // own DateRangePicker is where the guest actually picks dates.
    const firstRoomId = roomIds[0]
    if (!firstRoomId) {
      // Type name matched nothing in Rooms at all — shouldn't happen for
      // one of the 4 known types, but don't send the guest to a 404.
      const query = guestParams.toString()
      redirect(query ? `/rooms?${query}` : '/rooms')
    }
    const query = guestParams.toString()
    redirect(`/rooms/${firstRoomId}${query ? `?${query}` : ''}`)
  }

  const resolvedRoomId = await resolveAvailableRoomId(roomIds, checkIn, checkOut)

  guestParams.set('checkin', checkIn)
  guestParams.set('checkout', checkOut)

  if (!resolvedRoomId) {
    // Genuinely nothing free any more (e.g. the last room of this type
    // was booked by someone else in the moments between opening the
    // modal and clicking through) — back to the listing with the same
    // dates so it re-checks and correctly shows this type (and every
    // other) as of right now, rather than stranding the guest.
    redirect(`/rooms?${guestParams.toString()}`)
  }

  redirect(`/rooms/${resolvedRoomId}?${guestParams.toString()}`)
}
