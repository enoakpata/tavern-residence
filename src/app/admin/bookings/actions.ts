'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { bookingsQuery } from '@/lib/adminBookings'
import { isRoomAvailable, calculateCancellationOutcome } from '@/lib/bookings'
import { chargeAuthorization } from '@/lib/paystack'
import {
  sendEmail,
  buildGuestConfirmationEmail,
  buildCancellationNotificationEmail,
} from '@/lib/email'
import type { Room } from '@/lib/types'

type ActionResult = { success: true } | { success: false; error: string }

const NON_CANCELLABLE_STATUSES = ['cancelled', 'checked_out', 'no_show']
const HOTEL_NOTIFICATION_EMAIL = 'tavernresidence@gmail.com'

/**
 * Fetches one booking's full detail (every field, plus its room) for the
 * "View" detail panel — shared by both the bookings table and the
 * notification dropdown, which only ever has a booking_id on hand, not a
 * full row already in memory. Uses the same bookingsQuery() the table and
 * Today's Check-ins/Check-outs pages already share, so this view can never
 * show a different shape of data than either of those.
 */
export async function getBookingDetail(bookingId: string) {
  const supabase = await createClient()
  const { data, error } = await bookingsQuery(supabase).eq('id', bookingId).single()

  if (error || !data) return null
  return data
}

/**
 * Manual booking entry — used for walk-ins and phone bookings. Unlike the
 * guest-facing form, there's no Paystack card verification here: a walk-in
 * pays at the front desk (POS or cash), and a phone booking either pays by
 * transfer or the receptionist takes card details over a payment link
 * outside this system entirely. So this just records the booking.
 */
export async function createManualBooking(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const roomId = formData.get('room_id') as string
  const guestName = formData.get('guest_name') as string
  const guestPhone = formData.get('guest_phone') as string
  const guestEmail = (formData.get('guest_email') as string) || null
  const checkIn = formData.get('check_in') as string
  const checkOut = formData.get('check_out') as string
  const source = formData.get('source') as 'walk_in' | 'phone'
  const paymentMethod = formData.get('payment_method') as 'card' | 'transfer'
  const paymentStatus = formData.get('payment_status') as 'unpaid' | 'paid'

  if (!roomId || !guestName || !guestPhone || !checkIn || !checkOut || !source) {
    return { success: false, error: 'Please fill in all required fields.' }
  }
  if (checkOut <= checkIn) {
    return { success: false, error: 'Check-out must be after check-in.' }
  }

  const available = await isRoomAvailable(roomId, checkIn, checkOut)
  if (!available) {
    return { success: false, error: 'This room is not available for those dates.' }
  }

  // Generated up front (rather than left to the DB default) so it's
  // available below for the guest's "manage your booking" email link,
  // matching the same pattern the guest-facing booking flow already uses.
  const bookingId = crypto.randomUUID()

  const { error } = await supabase.from('Bookings').insert({
    id: bookingId,
    room_id: roomId,
    guest_name: guestName,
    guest_phone: guestPhone,
    guest_email: guestEmail,
    check_in: checkIn,
    check_out: checkOut,
    status: 'confirmed', // staff-entered bookings are confirmed on the spot
    source,
    payment_method: paymentMethod,
    payment_status: paymentStatus,
    created_by: user?.email ?? null,
  })

  if (error) {
    console.error('Manual booking insert failed:', error)
    return { success: false, error: 'Something went wrong. Please try again.' }
  }

  // Booking is already recorded at this point — email is a nice-to-have on
  // top, so a failure here must never turn a successful booking into an
  // error response. Staff already know a booking came in (they just
  // created it), so only the guest gets emailed here.
  if (guestEmail) {
    try {
      const { data: roomData } = await supabase
        .from('Rooms')
        .select('name, room_number')
        .eq('id', roomId)
        .single()
      const roomName = roomData?.name ?? 'your room'
      const roomNumber = roomData?.room_number ?? ''

      const guestEmailContent = buildGuestConfirmationEmail({
        guestName,
        roomNumber,
        roomName,
        checkIn,
        checkOut,
        bookingId,
      })
      await sendEmail({ to: guestEmail, ...guestEmailContent })
    } catch (emailError) {
      console.error('Booking confirmation email failed to send:', emailError)
    }
  }

  revalidatePath('/admin/bookings')
  revalidatePath('/admin/check-in/check-out')
  return { success: true }
}

/**
 * Lists every room annotated with whether it's free for the given date
 * range — used by the manual booking form so staff can see the full room
 * list (with unavailable ones greyed out) instead of a silently filtered
 * one. Reuses the same overlap check `createManualBooking` relies on as
 * its final safety net.
 */
export async function getAvailableRooms(
  checkIn: string,
  checkOut: string
): Promise<(Room & { available: boolean })[]> {
  const supabase = await createClient()
  const { data: rooms, error } = await supabase
    .from('Rooms')
    .select('*')
    .order('room_number', { ascending: true })

  if (error || !rooms) {
    console.error('Failed to fetch rooms:', error)
    return []
  }

  return Promise.all(
    (rooms as Room[]).map(async (room) => ({
      ...room,
      available: await isRoomAvailable(room.id, checkIn, checkOut),
    }))
  )
}

/**
 * Confirms a bank transfer manually — the receptionist has checked the
 * hotel's bank account and seen the money land, so this just flips the
 * status. There's no automated verification for transfers.
 */
export async function markAsPaid(bookingId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('Bookings')
    .update({ payment_status: 'paid' })
    .eq('id', bookingId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/bookings')
  revalidatePath('/admin/check-in/check-out')
  return { success: true }
}

/**
 * Charges the guest's saved card for the full stay — uses the
 * authorization_code captured during the ₦100 verification charge at
 * booking time. This is the "charge at check-in" action.
 */
export async function chargeFullStay(
  bookingId: string,
  authorizationCode: string,
  amountNaira: number,
  guestEmail: string
): Promise<ActionResult> {
  const result = await chargeAuthorization(authorizationCode, amountNaira, guestEmail)
  if (!result.success) {
    return { success: false, error: result.error ?? 'Charge failed.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('Bookings')
    .update({
      payment_status: 'paid',
      charge_type: 'full_stay',
      amount_charged: amountNaira,
    })
    .eq('id', bookingId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/bookings')
  revalidatePath('/admin/check-in/check-out')
  return { success: true }
}

/**
 * Combined action for the Today's Check-ins flow: charges the guest's
 * saved card for the full stay, and only flips status to checked_in if
 * that charge actually succeeds — reuses chargeFullStay and
 * updateBookingStatus as-is rather than duplicating either piece of logic.
 */
export async function chargeAndCheckIn(
  bookingId: string,
  authorizationCode: string,
  amountNaira: number,
  guestEmail: string
): Promise<ActionResult> {
  const chargeResult = await chargeFullStay(bookingId, authorizationCode, amountNaira, guestEmail)
  if (!chargeResult.success) {
    return chargeResult
  }

  return updateBookingStatus(bookingId, 'checked_in')
}

/**
 * Check-in path for when the client didn't think a card charge was
 * needed — re-checks the booking's actual payment state here rather than
 * trusting that judgment, since payment_method === 'card' alone doesn't
 * mean there's a real chargeable token (a walk-in paid by POS also gets
 * payment_method: 'card', with no Paystack token at all):
 *  - already paid -> just flips status, no charge attempted
 *  - unpaid with no token on file (e.g. an unconfirmed transfer) ->
 *    blocked with a clear message, instead of silently checking in an
 *    unpaid guest
 */
export async function checkInWithoutCharge(bookingId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: booking, error: fetchError } = await supabase
    .from('Bookings')
    .select('payment_status')
    .eq('id', bookingId)
    .single()

  if (fetchError || !booking) {
    return { success: false, error: 'Booking not found.' }
  }

  if (booking.payment_status === 'paid') {
    return updateBookingStatus(bookingId, 'checked_in')
  }

  return {
    success: false,
    error: "This booking hasn't been marked as paid yet — confirm payment before checking in.",
  }
}

/**
 * Charges the 50% fee for a no-show or late cancellation — same mechanism
 * as the full-stay charge, just a different amount and charge_type so your
 * records show why the guest was charged.
 */
export async function chargeNoShowFee(
  bookingId: string,
  authorizationCode: string,
  fullAmountNaira: number,
  guestEmail: string
): Promise<ActionResult> {
  const feeAmount = Math.round(fullAmountNaira * 0.5)
  const result = await chargeAuthorization(authorizationCode, feeAmount, guestEmail)
  if (!result.success) {
    return { success: false, error: result.error ?? 'Charge failed.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('Bookings')
    .update({
      status: 'no_show',
      payment_status: 'paid',
      charge_type: 'no_show_fee',
      amount_charged: feeAmount,
    })
    .eq('id', bookingId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/bookings')
  revalidatePath('/admin/check-in/check-out')
  return { success: true }
}

/**
 * Plain status update — confirming, checking a guest in/out, or cancelling.
 * No payment logic involved, just moves the booking through its lifecycle.
 */
export async function updateBookingStatus(
  bookingId: string,
  status: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('Bookings')
    .update({ status })
    .eq('id', bookingId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/bookings')
  revalidatePath('/admin/check-in/check-out')
  return { success: true }
}

export type CancelBookingResult =
  | { success: true; feeCharged: boolean; feeAmount: number }
  | { success: false; error: string }

/**
 * Staff-initiated cancellation from the admin dashboard — mirrors the
 * guest-facing cancelBooking action (src/app/(site)/booking/[id]/actions.ts)
 * but runs under the authenticated admin session instead of the
 * service-role client, and revalidates the admin bookings page instead of
 * the guest's manage-booking page. Also treats a booking with no card on
 * file (e.g. paid by transfer) as always free to cancel, since there's
 * nothing to charge — staff handle any fee collection for those manually.
 */
export async function cancelBookingByStaff(bookingId: string): Promise<CancelBookingResult> {
  const supabase = await createClient()

  const { data: booking, error: fetchError } = await supabase
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

  // payment_method === 'card' alone doesn't mean there's a real token to
  // charge — a walk-in who paid via a physical POS card machine also gets
  // payment_method: 'card' recorded, with no Paystack token at all. The
  // actual token's presence is the real signal for "chargeable".
  const hasCardOnFile = Boolean(booking.payment_token)
  const { free, feeAmount } = calculateCancellationOutcome(booking, booking.Rooms)

  // Free cancellation: either within a free-cancellation window (more
  // than 24 hours before check-in, or the 1-hour grace period after
  // booking), or no card on file to charge at all.
  if (free || !hasCardOnFile) {
    const { error } = await supabase
      .from('Bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)

    if (error) return { success: false, error: 'Something went wrong. Please try again.' }

    await notifyCancellationByEmail(booking, false, 0)

    revalidatePath('/admin/bookings')
    revalidatePath('/admin/check-in/check-out')
    return { success: true, feeCharged: false, feeAmount: 0 }
  }

  // Outside both free-cancellation windows, with a card on file — a 50%
  // late-cancellation fee applies.
  if (!booking.guest_email) {
    return {
      success: false,
      error: 'No email on file to process this charge — cancel and collect the fee manually.',
    }
  }

  const charge = await chargeAuthorization(booking.payment_token, feeAmount, booking.guest_email)
  if (!charge.success) {
    return { success: false, error: `Card declined: ${charge.error}` }
  }

  const { error } = await supabase
    .from('Bookings')
    .update({
      status: 'cancelled',
      payment_status: 'paid',
      charge_type: 'late_cancellation_fee',
      amount_charged: feeAmount,
    })
    .eq('id', bookingId)

  if (error) return { success: false, error: 'Something went wrong. Please try again.' }

  await notifyCancellationByEmail(booking, true, feeAmount)

  revalidatePath('/admin/bookings')
  revalidatePath('/admin/check-in/check-out')
  return { success: true, feeCharged: true, feeAmount }
}

/**
 * Emails the hotel when staff cancel a booking — no in-app notification
 * row here, since staff already know they just did it (those are only
 * created for guest-initiated cancellations). Best-effort: never blocks
 * the cancellation, which has already succeeded by the time this runs.
 */
async function notifyCancellationByEmail(
  booking: {
    guest_name: string
    check_in: string
    check_out: string
    Rooms?: { room_number: string; name: string } | null
  },
  feeCharged: boolean,
  feeAmount: number
) {
  try {
    await sendEmail({
      to: HOTEL_NOTIFICATION_EMAIL,
      ...buildCancellationNotificationEmail({
        guestName: booking.guest_name,
        roomNumber: booking.Rooms?.room_number ?? '',
        roomName: booking.Rooms?.name ?? 'the room',
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        feeCharged,
        feeAmount,
      }),
    })
  } catch (emailError) {
    console.error('Cancellation notification email failed to send:', emailError)
  }
}
