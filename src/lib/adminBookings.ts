import type { SupabaseClient } from '@supabase/supabase-js'

// The exact Bookings+Rooms shape every admin view of bookings needs — kept
// in one place so "All Bookings", "Today's Check-ins/Check-outs", and any
// future admin view of the same data can never quietly drift out of sync
// by hand-editing separate select strings that were meant to match.
export const BOOKINGS_WITH_ROOM_SELECT =
  '*, Rooms(room_number, name, room_type, price_per_night)'

export function bookingsQuery(supabase: SupabaseClient) {
  return supabase.from('Bookings').select(BOOKINGS_WITH_ROOM_SELECT)
}
