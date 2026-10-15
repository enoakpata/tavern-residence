'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { calculateCancellationOutcome, getChargeableAuthCode } from '@/lib/bookings'
import { sendEmail, buildCancellationNotificationEmail } from '@/lib/email'
import { HOTEL_EMAIL } from '@/lib/siteConfig'
import { displayRoomName } from '@/lib/roomTypeContent'
import type { ManageBookingErrorCode } from '@/lib/manageBookingMessages'

const NON_CANCELLABLE_STATUSES = ['cancelled', 'checked_out', 'no_show']

// An error code, never raw text — see findBookings in
// manage-booking/actions.ts for the same pattern and why.
export type CancelBookingResult =
  | { success: true; feeMayApply: boolean; feeAmount: number; alreadyPaid: boolean }
  | { success: false; code: ManageBookingErrorCode }

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
  feeMayApply: boolean,
  feeAmount: number
) {
  const roomNumber = booking.Rooms?.room_number ?? ''
  const roomName = displayRoomName(booking.Rooms?.name, 'the room')
  const message = `Booking cancelled by guest: ${booking.guest_name} — Room ${roomNumber}${
    feeMayApply ? ` (₦${feeAmount.toLocaleString()} fee may apply — not charged automatically)` : ''
  }`

  const results = await Promise.allSettled([
    sendEmail({
      to: HOTEL_EMAIL,
      ...buildCancellationNotificationEmail({
        guestName: booking.guest_name,
        roomNumber,
        roomName,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        feeCharged: false,
        feeAmount,
        feePending: feeMayApply,
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

/**
 * Guest self-service cancellation — never charges a card. This always
 * just cancels the booking; when the cancellation policy would normally
 * suggest a fee (outside the free-cancellation window, with a chargeable
 * card on file), the guest is told a fee may apply per policy and staff
 * are notified to apply it manually (via "Charge saved card" in the admin
 * dashboard) rather than this charging automatically.
 */
export async function cancelBooking(bookingId: string): Promise<CancelBookingResult> {
  const { data: booking, error: fetchError } = await supabaseAdmin
    .from('Bookings')
    .select('*, Rooms(price_per_night, room_number, name)')
    .eq('id', bookingId)
    .single()

  if (fetchError || !booking) {
    if (fetchError) console.error('cancelBooking fetch failed:', fetchError)
    return { success: false, code: 'not_found' }
  }

  if (booking.status === 'cancelled') {
    return { success: false, code: 'already_cancelled' }
  }
  if (NON_CANCELLABLE_STATUSES.includes(booking.status)) {
    return { success: false, code: 'cancel_locked' }
  }

  const { feeApplies, feeAmount } = calculateCancellationOutcome(booking, booking.Rooms)
  const hasCardOnFile = Boolean(getChargeableAuthCode(booking)) && booking.card_reusable !== false
  // Already paid: no cancellation fee applies regardless of timing —
  // same rule as the admin-side cancellation (section 8), extended to
  // the guest's own flow. There was never an automatic charge here
  // either way (see this function's own doc comment); this only
  // changes what the guest is told, so it doesn't claim a fee applies
  // when staff wouldn't actually apply one.
  const alreadyPaid = Number(booking.amount_paid ?? 0) > 0
  const feeMayApply = feeApplies && hasCardOnFile && !alreadyPaid

  const { error } = await supabaseAdmin
    .from('Bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)

  if (error) {
    console.error('cancelBooking update failed:', error)
    return { success: false, code: 'server_error' }
  }

  await notifyCancellation(bookingId, booking, feeMayApply, feeAmount)

  revalidatePath(`/booking/${bookingId}`)
  // Keeps the admin dashboard's cached pages from showing a booking as
  // still active after a guest cancels it themselves online.
  revalidatePath('/admin/bookings')
  revalidatePath('/admin/check-in/check-out')
  revalidatePath('/admin/calendar')
  return { success: true, feeMayApply, feeAmount, alreadyPaid }
}
