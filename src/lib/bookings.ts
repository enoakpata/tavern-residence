import { supabase } from './supabase'
import { supabaseAdmin } from './supabaseAdmin'
import { getCancellationOutcome } from './cancellationPolicy'

/**
 * Statuses that mean a booking still occupies its room's dates — used
 * everywhere an availability/blocked-dates query decides which existing
 * rows count against a room. Kept as one shared list so a new status only
 * has to be added in one place, rather than risking one of several
 * duplicated arrays being missed and a room being double-booked.
 */
export const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'checked_in']

/**
 * Returns true if the room is free for the given date range.
 * A booking blocks the room if it's "pending", "confirmed", or already
 * "checked_in" — cancelled/no_show/checked_out bookings don't block.
 *
 * Overlap logic: two date ranges [checkIn, checkOut) overlap when
 * existing.check_in < newCheckOut AND existing.check_out > newCheckIn
 *
 * `excludeBookingId` — for checking availability when editing a booking's
 * own dates, so it doesn't conflict with the very row it's about to
 * replace. This has to bypass the public booking_availability view: that
 * view deliberately exposes no `id` column (booking IDs are the only
 * "auth" on a guest's /booking/[id] management link, so a publicly
 * queryable view is not a safe place to expose them), so excluding by id
 * means querying the real Bookings table with the service-role client
 * instead. Only ever pass this from admin-only server code.
 */
export async function isRoomAvailable(
  roomId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string
) {
  if (excludeBookingId) {
    const { data, error } = await supabaseAdmin
      .from('Bookings')
      .select('id')
      .eq('room_id', roomId)
      .in('status', ACTIVE_BOOKING_STATUSES)
      .lt('check_in', checkOut)
      .gt('check_out', checkIn)
      .neq('id', excludeBookingId)

    if (error) {
      console.error('Availability check failed:', error)
      return false
    }

    return data.length === 0
  }

  const { data, error } = await supabase
  .from('booking_availability')
  .select('room_id')
  .eq('room_id', roomId)
  .in('status', ACTIVE_BOOKING_STATUSES)
  .lt('check_in', checkOut)
  .gt('check_out', checkIn)

  if (error) {
    console.error('Availability check failed:', error)
    // Fail closed: if we can't verify, don't let the booking through
    return false
  }

  return data.length === 0
}

/**
 * Given every physical room_id sharing one type (see roomTypeContent.ts),
 * returns ONE that's actually free for the date range — the first in
 * `roomIds` order with no blocking booking — or null if none are. Callers
 * that just need a yes/no (the /rooms type-grouped listing) use
 * isAnyRoomAvailable below; the resolver used at "Book This Room"
 * click-through (rooms/book/page.tsx) needs the actual id, to redirect
 * into that one specific room's existing, unmodified booking page/flow.
 * Same public booking_availability view and overlap logic as
 * isRoomAvailable's own non-admin branch — this never needs the
 * excludeBookingId case, since nothing admin-side edits a "type" the way
 * a single booking's dates get edited.
 */
export async function resolveAvailableRoomId(
  roomIds: string[],
  checkIn: string,
  checkOut: string
): Promise<string | null> {
  if (roomIds.length === 0) return null

  const { data, error } = await supabase
    .from('booking_availability')
    .select('room_id')
    .in('room_id', roomIds)
    .in('status', ACTIVE_BOOKING_STATUSES)
    .lt('check_in', checkOut)
    .gt('check_out', checkIn)

  if (error) {
    console.error('Type availability check failed:', error)
    // Fail closed: if we can't verify, don't let the booking through
    return null
  }

  const blockedRoomIds = new Set(data.map((row) => row.room_id as string))
  return roomIds.find((id) => !blockedRoomIds.has(id)) ?? null
}

/**
 * Like isRoomAvailable, but for a whole room TYPE at once — true if AT
 * LEAST ONE of the given physical room_ids is free for the date range.
 * Used by the /rooms type-grouped listing: a "type" card represents every
 * physical room sharing that type's name, not one hardcoded room_id, so
 * availability has to be checked across the whole group rather than a
 * single row.
 */
export async function isAnyRoomAvailable(
  roomIds: string[],
  checkIn: string,
  checkOut: string
): Promise<boolean> {
  return (await resolveAvailableRoomId(roomIds, checkIn, checkOut)) !== null
}

/**
 * Fetches-the-data-and-decides wrapper around the shared cancellation
 * rule in src/lib/cancellationPolicy.ts, used by both the guest-facing
 * and staff-facing cancellation server actions. The actual free/fee
 * calculation lives in that shared, dependency-free module (also used
 * directly by the client-side confirm-modal previews), so this function
 * just adapts the booking/room shape those actions already have on hand
 * into the plain inputs that calculation needs.
 */
export function calculateCancellationOutcome(
  booking: { created_at: string; check_in: string },
  room: { price_per_night: number } | null | undefined
): { free: boolean; feeAmount: number } {
  return getCancellationOutcome({
    createdAt: booking.created_at,
    checkIn: booking.check_in,
    pricePerNight: room?.price_per_night ?? 0,
  })
}
