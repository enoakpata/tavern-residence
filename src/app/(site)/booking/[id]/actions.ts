'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { calculateCancellationOutcome } from '@/lib/bookings'
import { chargeAuthorization } from '@/lib/paystack'
import { sendEmail, buildCancellationNotificationEmail } from '@/lib/email'

const NON_CANCELLABLE_STATUSES = ['cancelled', 'checked_out', 'no_show']
const HOTEL_PHONE = '0701 583 2637'
const HOTEL_NOTIFICATION_EMAIL = 'tavernresidence@gmail.com'

export type CancelBookingResult =
  | { success: true; feeCharged: boolean; feeAmount: number }
  | { success: false; error: string }

/**
 * Notifies the hotel a guest cancelled their own booking (email + an
 * in-app notification row) — best-effort, since neither should ever
 * block the cancellation itself, which has already succeeded by the time
 * this runs.
 */
async function notifyCancellation(
  bookingId: string,
  booking: {
    guest_name: string
    check_in: string
    check_out: string
    Rooms?: { room_number: string; name: string } | null
  },
  feeCharged: boolean,
  feeAmount: number
) {
  const roomNumber = booking.Rooms?.room_number ?? ''
  const roomName = booking.Rooms?.name ?? 'the room'
  const message = `Booking cancelled: ${booking.guest_name} — Room ${roomNumber} (${
    feeCharged ? `₦${feeAmount.toLocaleString()} fee charged` : 'no fee'
  })`

  const results = await Promise.allSettled([
    sendEmail({
      to: HOTEL_NOTIFICATION_EMAIL,
      ...buildCancellationNotificationEmail({
        guestName: booking.guest_name,
        roomNumber,
        roomName,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        feeCharged,
        feeAmount,
      }),
    }),
    supabaseAdmin.from('Notifications').insert({
      type: 'cancellation',
      message,
      booking_id: bookingId,
    }),
  ])
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Cancellation notification failed:', result.reason)
    }
  }
}

export async function cancelBooking(bookingId: string): Promise<CancelBookingResult> {
  const { data: booking, error: fetchError } = await supabaseAdmin
    .from('Bookings')
    .select('*, Rooms(price_per_night, room_number, name)')
    .eq('id', bookingId)
    .single()

  if (fetchError || !booking) {
    return { success: false, error: 'Booking not found.' }
  }

  if (NON_CANCELLABLE_STATUSES.includes(booking.status)) {
    return { success: false, error: 'This booking can no longer be cancelled.' }
  }

  const { free, feeAmount } = calculateCancellationOutcome(booking, booking.Rooms)

  // Free cancellation — either more than 24 hours before check-in, or
  // within the 1-hour grace period after the booking was created.
  if (free) {
    const { error } = await supabaseAdmin
      .from('Bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)

    if (error) return { success: false, error: 'Something went wrong. Please try again.' }

    await notifyCancellation(bookingId, booking, false, 0)

    revalidatePath(`/booking/${bookingId}`)
    return { success: true, feeCharged: false, feeAmount: 0 }
  }

  // Outside both free-cancellation windows — a 50% late-cancellation fee
  // applies, charged to the card saved at booking time via the same
  // helper the admin dashboard uses for no-show fees.
  if (!booking.payment_token || !booking.guest_email) {
    return {
      success: false,
      error: `We couldn't process the cancellation fee — please contact us directly to cancel: ${HOTEL_PHONE}`,
    }
  }

  const charge = await chargeAuthorization(booking.payment_token, feeAmount, booking.guest_email)
  if (!charge.success) {
    return {
      success: false,
      error: `We couldn't process the cancellation fee (${charge.error}). Please contact us directly to cancel: ${HOTEL_PHONE}`,
    }
  }

  const { error } = await supabaseAdmin
    .from('Bookings')
    .update({
      status: 'cancelled',
      payment_status: 'paid',
      charge_type: 'late_cancellation_fee',
      amount_charged: feeAmount,
    })
    .eq('id', bookingId)

  if (error) return { success: false, error: 'Something went wrong. Please try again.' }

  await notifyCancellation(bookingId, booking, true, feeAmount)

  revalidatePath(`/booking/${bookingId}`)
  return { success: true, feeCharged: true, feeAmount }
}
