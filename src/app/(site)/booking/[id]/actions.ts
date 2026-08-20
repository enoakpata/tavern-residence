'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { chargeAuthorization } from '@/lib/paystack'

const NON_CANCELLABLE_STATUSES = ['cancelled', 'checked_out', 'no_show']
const HOTEL_PHONE = '0701 583 2637'

export type CancelBookingResult =
  | { success: true; feeCharged: boolean; feeAmount: number }
  | { success: false; error: string }

/**
 * 2:00 PM Lagos time (WAT, UTC+1, no daylight saving) for the given
 * check-in date, expressed as an explicit UTC instant so the 24-hour
 * cutoff below is correct no matter what timezone the server itself runs
 * in.
 */
function checkInMoment(checkInDate: string): Date {
  return new Date(`${checkInDate}T13:00:00Z`)
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime()
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)))
}

export async function cancelBooking(bookingId: string): Promise<CancelBookingResult> {
  const { data: booking, error: fetchError } = await supabaseAdmin
    .from('Bookings')
    .select('*, Rooms(price_per_night)')
    .eq('id', bookingId)
    .single()

  if (fetchError || !booking) {
    return { success: false, error: 'Booking not found.' }
  }

  if (NON_CANCELLABLE_STATUSES.includes(booking.status)) {
    return { success: false, error: 'This booking can no longer be cancelled.' }
  }

  const hoursUntilCheckIn =
    (checkInMoment(booking.check_in).getTime() - Date.now()) / (1000 * 60 * 60)

  // More than 24 hours before check-in — free cancellation.
  if (hoursUntilCheckIn > 24) {
    const { error } = await supabaseAdmin
      .from('Bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)

    if (error) return { success: false, error: 'Something went wrong. Please try again.' }

    revalidatePath(`/booking/${bookingId}`)
    return { success: true, feeCharged: false, feeAmount: 0 }
  }

  // Within 24 hours of check-in (or check-in has already passed) — a 50%
  // late-cancellation fee applies, charged to the card saved at booking
  // time via the same helper the admin dashboard uses for no-show fees.
  const pricePerNight = booking.Rooms?.price_per_night ?? 0
  const feeAmount = Math.round(
    pricePerNight * nightsBetween(booking.check_in, booking.check_out) * 0.5
  )

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

  revalidatePath(`/booking/${bookingId}`)
  return { success: true, feeCharged: true, feeAmount }
}
