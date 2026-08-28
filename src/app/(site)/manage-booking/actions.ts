'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type BookingSearchResult = {
  id: string
  check_in: string
  check_out: string
  status: string
  room_name: string
  room_number: string
}

/**
 * Looks up bookings by phone + email together, rather than either alone —
 * with no guest login system, this is the narrowest reasonable filter a
 * guest can self-serve without exposing other guests' reservations to a
 * lucky/guessed single field.
 */
export async function findBookings(
  phone: string,
  email: string
): Promise<{ bookings: BookingSearchResult[] }> {
  const trimmedPhone = phone.trim()
  const trimmedEmail = email.trim()

  if (!trimmedPhone || !trimmedEmail) {
    return { bookings: [] }
  }

  const { data } = await supabaseAdmin
    .from('Bookings')
    .select('id, check_in, check_out, status, Rooms(name, room_number)')
    .eq('guest_phone', trimmedPhone)
    .ilike('guest_email', trimmedEmail)
    .order('check_in', { ascending: false })

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
      room_name: room?.name ?? 'Room',
      room_number: room?.room_number ?? '',
    }
  })

  return { bookings }
}
