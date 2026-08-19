import { supabase } from './supabase'

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
