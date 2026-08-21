import { supabase } from './supabase'
import { getCancellationOutcome } from './cancellationPolicy'

/**
 * Returns true if the room is free for the given date range.
 * A booking blocks the room if it's "pending" or "confirmed" or already
 * "checked_in" — cancelled/no_show/checked_out bookings don't block.
 *
 * Overlap logic: two date ranges [checkIn, checkOut) overlap when
 * existing.check_in < newCheckOut AND existing.check_out > newCheckIn
 */
export async function isRoomAvailable(
  roomId: string,
  checkIn: string,
  checkOut: string
) {
  const { data, error } = await supabase
  .from('booking_availability')
  .select('room_id')
  .eq('room_id', roomId)
  .in('status', ['pending', 'confirmed', 'checked_in'])
  .lt('check_in', checkOut)
  .gt('check_out', checkIn)

  if (error) {
    console.error('Availability check failed:', error)
    // Fail closed: if we can't verify, don't let the booking through
    return false
  }

  return data.length === 0
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime()
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)))
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
  booking: { created_at: string; check_in: string; check_out: string },
  room: { price_per_night: number } | null | undefined
): { free: boolean; feeAmount: number } {
  return getCancellationOutcome({
    createdAt: booking.created_at,
    checkIn: booking.check_in,
    pricePerNight: room?.price_per_night ?? 0,
    nights: nightsBetween(booking.check_in, booking.check_out),
  })
}
