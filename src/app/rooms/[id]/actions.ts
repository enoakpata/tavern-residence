'use server'

import { supabase } from '@/lib/supabase'
import { isRoomAvailable } from '@/lib/bookings'

export type BookingResult =
  | { success: true; bookingId: string }
  | { success: false; error: string }

export async function createBooking(formData: FormData): Promise<BookingResult> {
  const roomId = formData.get('room_id') as string
  const guestName = formData.get('guest_name') as string
  const guestPhone = formData.get('guest_phone') as string
  const guestEmail = (formData.get('guest_email') as string) || null
  const checkIn = formData.get('check_in') as string
  const checkOut = formData.get('check_out') as string
  const paymentMethod = formData.get('payment_method') as 'card' | 'transfer'

  // Basic validation — mirrors what the form already enforces, but never
  // trust the client alone since this runs on the server
  if (!roomId || !guestName || !guestPhone || !checkIn || !checkOut) {
    return { success: false, error: 'Please fill in all required fields.' }
  }

  if (checkOut <= checkIn) {
    return { success: false, error: 'Check-out must be after check-in.' }
  }

  // Re-check availability here on the server, right before inserting.
  // Checking only in the browser isn't safe — two guests could both
  // pass a client-side check at nearly the same time.
  const available = await isRoomAvailable(roomId, checkIn, checkOut)
  if (!available) {
    return {
      success: false,
      error: 'This room is no longer available for those dates.',
    }
  }

  const { data, error } = await supabase
    .from('Bookings')
    .insert({
      room_id: roomId,
      guest_name: guestName,
      guest_phone: guestPhone,
      guest_email: guestEmail,
      check_in: checkIn,
      check_out: checkOut,
      status: 'pending',
      source: 'online',
      payment_method: paymentMethod,
      payment_status:
        paymentMethod === 'transfer' ? 'awaiting_verification' : 'unpaid',
    })
    .select('id')
    .single()

  if (error) {
    console.error('Booking insert failed:', error)
    return { success: false, error: 'Something went wrong. Please try again.' }
  }

  return { success: true, bookingId: data.id }
}
