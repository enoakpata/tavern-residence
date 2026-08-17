'use server'

import { supabase } from '@/lib/supabase'
import { isRoomAvailable } from '@/lib/bookings'
import { verifyTransaction, refundTransaction } from '@/lib/paystack'

export async function checkAvailability(
  roomId: string,
  checkIn: string,
  checkOut: string
): Promise<{ available: boolean; error?: string }> {
  if (!roomId || !checkIn || !checkOut) {
    return { available: false, error: 'Please choose your check-in and check-out dates.' }
  }
  if (checkOut <= checkIn) {
    return { available: false, error: 'Check-out must be after check-in.' }
  }
  const available = await isRoomAvailable(roomId, checkIn, checkOut)
  if (!available) {
    return { available: false, error: 'This room is not available for those dates.' }
  }
  return { available: true }
}

export type BookingResult =
  | { success: true; bookingId: string }
  | { success: false; error: string }

export async function createBooking(formData: FormData): Promise<BookingResult> {
  const roomId = formData.get('room_id') as string
  const guestName = formData.get('guest_name') as string
  const guestPhone = formData.get('guest_phone') as string
  const guestEmail = formData.get('guest_email') as string
  const checkIn = formData.get('check_in') as string
  const checkOut = formData.get('check_out') as string
  const paystackReference = formData.get('paystack_reference') as string

  // guest_email is now required — Paystack needs it to run the card
  // verification charge, whereas before it was optional
  if (
    !roomId ||
    !guestName ||
    !guestPhone ||
    !guestEmail ||
    !checkIn ||
    !checkOut ||
    !paystackReference
  ) {
    return { success: false, error: 'Please fill in all required fields.' }
  }

  if (checkOut <= checkIn) {
    return { success: false, error: 'Check-out must be after check-in.' }
  }

  // Re-check availability on the server, right before we touch payment or
  // insert anything — don't trust a client-side check alone, and don't
  // want to have charged/refunded a card only to find the room isn't
  // actually free.
  const available = await isRoomAvailable(roomId, checkIn, checkOut)
  if (!available) {
    return {
      success: false,
      error: 'This room is no longer available for those dates.',
    }
  }

  // Confirm the ₦100 verification charge actually succeeded, and pull out
  // the reusable authorization_code — this is the "saved card" we'll use
  // later for the real charge (full stay at check-in, or a no-show /
  // late-cancellation fee), without the guest re-entering card details.
  const verification = await verifyTransaction(paystackReference)
  if (!verification.success) {
    return { success: false, error: verification.error }
  }

  // Refund the ₦100 immediately — the guest should never actually be out
  // that money. If the refund call itself fails, we still proceed with
  // the booking (the card token is already valid), but this is logged
  // server-side so it can be checked manually.
  await refundTransaction(verification.transactionId)

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
      payment_method: 'card',
      payment_status: 'unpaid', // the real charge happens later, manually
      payment_token: verification.authorizationCode,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Booking insert failed:', error)
    return { success: false, error: 'Something went wrong. Please try again.' }
  }

  return { success: true, bookingId: data.id }
}
