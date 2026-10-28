'use server'

import { revalidatePath } from 'next/cache'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isRoomAvailable } from '@/lib/bookings'
import { todayInLagos } from '@/lib/dateUtils'
import { verifyTransaction, refundTransaction } from '@/lib/paystack'
import {
  sendEmail,
  buildGuestConfirmationEmail,
  buildHotelNotificationEmail,
} from '@/lib/email'
import { HOTEL_EMAIL } from '@/lib/siteConfig'
import { displayRoomName } from '@/lib/roomTypeContent'
import { stayTotal } from '@/lib/pricing'

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
  | { success: true; bookingId: string; createdAt: string }
  | { success: false; error: string }

export async function createBooking(formData: FormData): Promise<BookingResult> {
  const roomId = formData.get('room_id') as string
  const guestName = formData.get('guest_name') as string
  const guestPhone = formData.get('guest_phone') as string
  const guestEmail = formData.get('guest_email') as string
  const checkIn = formData.get('check_in') as string
  const checkOut = formData.get('check_out') as string
  const paystackReference = formData.get('paystack_reference') as string
  // Optional — trimmed to null rather than stored as an empty string, so
  // "nothing entered" reads unambiguously as no request at all wherever
  // this is displayed later (e.g. BookingDetailModal.tsx).
  const specialRequestsRaw = (formData.get('special_requests') as string | null)?.trim()
  const specialRequests = specialRequestsRaw ? specialRequestsRaw : null
  // Optional — only present when the guest arrived via the availability
  // bar's guest picker (see BookingForm.tsx's hidden inputs). Used only
  // to re-validate against this room's capacity below; never stored
  // (there's no guest-count column on Bookings).
  const adultsRaw = formData.get('adults') as string | null
  const childrenRaw = formData.get('children') as string | null
  const DIGITS_PATTERN = /^\d+$/
  const adultsNum = adultsRaw && DIGITS_PATTERN.test(adultsRaw) ? parseInt(adultsRaw, 10) : null
  const childrenNum = childrenRaw && DIGITS_PATTERN.test(childrenRaw) ? parseInt(childrenRaw, 10) : null
  const requestedGuests = adultsNum !== null ? adultsNum + (childrenNum ?? 0) : null

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

  // Fetched once, early — used for the capacity re-check right below and
  // reused further down (totalAmount) instead of querying Rooms twice.
  const { data: bookedRoom } = await supabase
    .from('Rooms')
    .select('name, price_per_night, max_occupancy')
    .eq('id', roomId)
    .single()

  // Re-validated server-side, not just trusted from the URL/hidden field
  // — a guest count large enough to exceed this room's own capacity
  // (e.g. a tampered room_id/adults combination) is refused here exactly
  // like an unavailable date range is, below.
  if (requestedGuests !== null && bookedRoom?.max_occupancy != null && requestedGuests > bookedRoom.max_occupancy) {
    return {
      success: false,
      error: `This room sleeps up to ${bookedRoom.max_occupancy} guests, which isn't enough for a party of ${requestedGuests}.`,
    }
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

  // Card consent is required (BookingForm.tsx gates this client-side via
  // a disabled confirm button) — re-checked here too, since this is the
  // actual authorization that lets us charge a cancellation/no-show fee
  // later, not just a UI nicety.
  const cardConsentPolicyVersion = formData.get('card_consent_policy_version') as string | null
  if (!cardConsentPolicyVersion) {
    return { success: false, error: 'Please confirm the cancellation policy checkbox to continue.' }
  }

  // Confirm the ₦100 verification charge actually succeeded, and pull out
  // the reusable authorization_code — this is the "saved card" we hold
  // ONLY for a later cancellation/no-show fee (see
  // src/app/admin/bookings/actions.ts's chargeSavedCard) — never for the
  // stay itself, which guests now pay us directly (transfer/POS).
  const verification = await verifyTransaction(paystackReference)
  if (!verification.success) {
    // The transaction can still have actually charged the guest even
    // though verification failed (e.g. a valid but non-reusable card) —
    // refund it whenever there's a transaction to refund, so the guest is
    // never out ₦100 just because we couldn't save their card.
    if (verification.transactionId != null) {
      await refundTransaction(verification.transactionId)
    }
    return { success: false, error: verification.error }
  }

  // Refund the ₦100 immediately — the guest should never actually be out
  // that money. If the refund call itself fails, we still proceed with
  // the booking (the card token is already valid), but this is logged
  // server-side so it can be checked manually.
  await refundTransaction(verification.transactionId)

const bookingId = crypto.randomUUID()
// Generated up front (rather than left to the DB default) so the exact
// same instant is available below for the confirmation email and the
// success screen's free-cancellation cutoff on same-day bookings.
const createdAt = new Date().toISOString()
const isSameDayBooking = checkIn === todayInLagos()
// Night-by-night, so any promo nights in the stay are priced at the
// promo rate and the rest at the normal rate — see src/lib/pricing.ts.
// The same function drives the total BookingForm.tsx showed the guest.
const totalAmount = bookedRoom ? stayTotal(bookedRoom, checkIn, checkOut) : 0

const { error } = await supabase.from('Bookings').insert({
  id: bookingId,
  room_id: roomId,
  guest_name: guestName,
  guest_phone: guestPhone,
  guest_email: guestEmail,
  check_in: checkIn,
  check_out: checkOut,
  status: 'confirmed', // card already verified via Paystack by this point
  source: 'online',
  // Still 'card' — a card genuinely was collected (for the fee-only
  // hold); it's just no longer charged for the stay. The actual method
  // used to pay the stay is tracked per-payment in booking_payments.method
  // once the guest actually pays (transfer/POS), not here.
  payment_method: 'card',
  payment_status: 'unpaid',
  total_amount: totalAmount,
  amount_paid: 0,
  payment_token: verification.authorizationCode, // legacy field, kept for any code still reading it — see getChargeableAuthCode
  card_authorization_code: verification.authorizationCode,
  card_last4: verification.last4,
  card_brand: verification.cardType,
  card_exp: `${verification.expMonth}/${verification.expYear}`,
  card_reusable: verification.reusable,
  card_consent_at: createdAt,
  card_consent_policy_version: cardConsentPolicyVersion,
  card_email: guestEmail,
  created_at: createdAt,
  special_requests: specialRequests,
})

if (error) {
  console.error('Booking insert failed:', error)
  return { success: false, error: 'Something went wrong. Please try again.' }
}

// Booking is already recorded at this point — email is a nice-to-have on
// top, so a failure here must never turn a successful booking into an
// error response. Sent concurrently and independently so one failing
// doesn't stop the other from going out.
const { data: roomData } = await supabase
  .from('Rooms')
  .select('name, room_number')
  .eq('id', roomId)
  .single()
const roomName = displayRoomName(roomData?.name, 'your room')
const roomNumber = roomData?.room_number ?? ''

const guestEmailContent = buildGuestConfirmationEmail({
  guestName,
  roomName,
  checkIn,
  checkOut,
  bookingId,
  createdAt,
  isSameDayBooking,
  totalAmount,
  cardLast4: verification.last4,
})
const hotelEmailContent = buildHotelNotificationEmail({
  guestName,
  guestPhone,
  roomNumber,
  roomName,
  checkIn,
  checkOut,
})

const notificationResults = await Promise.allSettled([
  sendEmail({ to: guestEmail, ...guestEmailContent }),
  sendEmail({ to: HOTEL_EMAIL, ...hotelEmailContent }),
  supabaseAdmin.from('Notifications').insert({
    type: 'new_booking',
    message: `New booking: ${guestName} — Room ${roomNumber}`,
    booking_id: bookingId,
  }),
])
for (const result of notificationResults) {
  if (result.status === 'rejected') {
    console.error('Booking confirmation email/notification failed:', result.reason)
  }
}

// Keeps the admin dashboard's cached pages from showing stale data —
// without this, a room a guest just booked online would still look
// available to staff until they hard-reload.
revalidatePath('/admin/bookings')
revalidatePath('/admin/check-in/check-out')
revalidatePath('/admin/calendar')

return { success: true, bookingId, createdAt }
}
