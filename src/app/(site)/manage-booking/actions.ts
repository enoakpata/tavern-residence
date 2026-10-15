'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { displayRoomName } from '@/lib/roomTypeContent'

export type BookingSearchResult = {
  id: string
  check_in: string
  check_out: string
  status: string
  room_name: string
}

// An error code, never raw text — src/lib/manageBookingMessages.ts is
// the only place that turns this into something a guest reads, so the
// wording can change without touching this logic, and nothing from a
// thrown exception or a Postgres error can ever reach the page.
export type FindBookingsResult =
  | { success: true; bookings: BookingSearchResult[] }
  | { success: false; code: 'server_error' }

/**
 * Looks up bookings by phone + email together, rather than either alone —
 * with no guest login system, this is the narrowest reasonable filter a
 * guest can self-serve without exposing other guests' reservations to a
 * lucky/guessed single field.
 */
export async function findBookings(phone: string, email: string): Promise<FindBookingsResult> {
  const trimmedPhone = phone.trim()
  const trimmedEmail = email.trim()

  if (!trimmedPhone || !trimmedEmail) {
    return { success: true, bookings: [] }
  }

  const { data, error } = await supabaseAdmin
    .from('Bookings')
    .select('id, check_in, check_out, status, Rooms(name)')
    .eq('guest_phone', trimmedPhone)
    .ilike('guest_email', trimmedEmail)
    // Checked-out bookings are treated as if they don't exist for guest
    // self-service — excluded at the query level (not filtered client-side)
    // so there's no path, including a direct result inspection, where one
    // surfaces. Cancelled bookings are unaffected and still listed.
    .neq('status', 'checked_out')
    .order('check_in', { ascending: false })

  if (error) {
    console.error('findBookings query failed:', error)
    return { success: false, code: 'server_error' }
  }

  const bookings: BookingSearchResult[] = (data ?? []).map((b) => {
    // Bookings -> Rooms is many-to-one, so PostgREST returns a single
    // embedded object at runtime — but without a generated schema type,
    // supabase-js can't infer that cardinality and types it as an array.
    const room = Array.isArray(b.Rooms) ? b.Rooms[0] : b.Rooms

    return {
      id: b.id,
      check_in: b.check_in,
      check_out: b.check_out,
      status: b.status,
      room_name: displayRoomName(room?.name, 'Room'),
    }
  })

  return { success: true, bookings }
}
