'use server'

import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isRoomAvailable } from '@/lib/bookings'
import { hotelTodayInLagos } from '@/lib/dateUtils'
import { verifyTransaction, refundTransaction } from '@/lib/paystack'
import { sendNewBookingNotifications } from '@/lib/bookingNotifications'
import {
  finalizeOnlinePayment,
  nairaToKobo,
  newOnlinePaymentReference,
  ROOM_NO_LONGER_AVAILABLE_ERROR,
} from '@/lib/onlinePayments'
import { stayTotal } from '@/lib/pricing'
import { getPromotions } from '@/lib/promotions'

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

type ValidatedBooking = {
  roomId: string
  guestName: string
  guestPhone: string
  guestEmail: string
  checkIn: string
  checkOut: string
  specialRequests: string | null
  cardConsentPolicyVersion: string
  room: { name: string; price_per_night: number; max_occupancy: number | null } | null
}

/**
 * Every check both payment options share, run before any money moves:
 * required fields, dates, the current hotel night, room capacity,
 * availability (the ROOM_NO_LONGER_AVAILABLE_ERROR re-check) and the
 * policy consent. Nothing is trusted from the client.
 */
async function validateGuestBooking(
  formData: FormData
): Promise<{ ok: true; value: ValidatedBooking } | { ok: false; error: string }> {
  const roomId = formData.get('room_id') as string
  const guestName = formData.get('guest_name') as string
  const guestPhone = formData.get('guest_phone') as string
  const guestEmail = formData.get('guest_email') as string
  const checkIn = formData.get('check_in') as string
  const checkOut = formData.get('check_out') as string
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

  // guest_email is required — Paystack needs it for either option.
  if (!roomId || !guestName || !guestPhone || !guestEmail || !checkIn || !checkOut) {
    return { ok: false, error: 'Please fill in all required fields.' }
  }

  if (checkOut <= checkIn) {
    return { ok: false, error: 'Check-out must be after check-in.' }
  }

  // The earliest bookable night is the current HOTEL night — before 12:00
  // PM Lagos that's still yesterday's (a 1 AM arrival books last night),
  // from 12:00 PM it's today. See hotelTodayInLagos in src/lib/dateUtils.ts.
  if (checkIn < hotelTodayInLagos()) {
    return { ok: false, error: 'That check-in date has already passed. Please choose new dates.' }
  }

  // Fetched once, early — used for the capacity re-check right below and
  // for pricing by the caller.
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
      ok: false,
      error: `This room sleeps up to ${bookedRoom.max_occupancy} guests, which isn't enough for a party of ${requestedGuests}.`,
    }
  }

  // Re-check availability on the server, right before we touch payment or
  // insert anything — don't trust a client-side check alone, and don't
  // want to have charged a card only to find the room isn't actually free.
  const available = await isRoomAvailable(roomId, checkIn, checkOut)
  if (!available) {
    return { ok: false, error: ROOM_NO_LONGER_AVAILABLE_ERROR }
  }

  // Policy consent is required (BookingForm.tsx gates this client-side via
  // a disabled confirm button) — re-checked here too, since for Pay in
  // person it's the actual authorization that lets us charge a
  // cancellation/no-show fee later, not just a UI nicety.
  const cardConsentPolicyVersion = formData.get('card_consent_policy_version') as string | null
  if (!cardConsentPolicyVersion) {
    return { ok: false, error: 'Please confirm the cancellation policy checkbox to continue.' }
  }

  return {
    ok: true,
    value: {
      roomId,
      guestName,
      guestPhone,
      guestEmail,
      checkIn,
      checkOut,
      specialRequests,
      cardConsentPolicyVersion,
      room: bookedRoom,
    },
  }
}

/**
 * Pay in person: the ₦100 card verification + refund saves a card on file
 * (for cancellation/no-show fees only), and the stay is paid at the hotel.
 */
export async function createBooking(formData: FormData): Promise<BookingResult> {
  const paystackReference = formData.get('paystack_reference') as string
  if (!paystackReference) {
    return { success: false, error: 'Please fill in all required fields.' }
  }

  const validated = await validateGuestBooking(formData)
  if (!validated.ok) return { success: false, error: validated.error }
  const {
    roomId,
    guestName,
    guestPhone,
    guestEmail,
    checkIn,
    checkOut,
    specialRequests,
    cardConsentPolicyVersion,
    room: bookedRoom,
  } = validated.value

  // Confirm the ₦100 verification charge actually succeeded, and pull out
  // the reusable authorization_code — this is the "saved card" we hold
  // ONLY for a later cancellation/no-show fee (see
  // src/app/admin/bookings/actions.ts's chargeSavedCard) — never for the
  // stay itself, which guests pay us directly (transfer/POS).
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
  // Same-day = booking for the current hotel night (incl. last night's, when
  // booked between midnight and 12:00 PM) — gets the 1-hour grace period.
  const isSameDayBooking = checkIn === hotelTodayInLagos()
  // Night-by-night, so any promo nights in the stay are priced at the
  // promo rate and the rest at the normal rate — see src/lib/pricing.ts.
  // The same function (and the same promotions table) drives the total
  // BookingForm.tsx showed the guest.
  const promos = await getPromotions()
  const totalAmount = bookedRoom ? stayTotal(bookedRoom, checkIn, checkOut, promos) : 0

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
    // hold); it's just not charged for the stay. The actual method used
    // to pay the stay is tracked per-payment in booking_payments.method
    // once the guest actually pays (transfer/POS), not here.
    payment_method: 'card',
    payment_status: 'unpaid',
    payment_option: 'pay_in_person',
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

  await sendNewBookingNotifications({
    bookingId,
    roomId,
    guestName,
    guestPhone,
    guestEmail,
    checkIn,
    checkOut,
    createdAt,
    isSameDayBooking,
    totalAmount,
    cardLast4: verification.last4,
    paymentOption: 'pay_in_person',
  })

  return { success: true, bookingId, createdAt }
}

export type StartOnlinePaymentResult =
  | { success: true; reference: string; amountKobo: number; email: string }
  | { success: false; error: string }

/**
 * Pay online, step 1: validates everything, prices the stay SERVER-SIDE
 * (stayTotal, promos included), and inserts a 'pending' booking that holds
 * the room while the guest pays. Returns the exact amount (kobo) and the
 * unique reference the client must open the Paystack popup with — the
 * client never decides the amount.
 */
export async function startOnlinePayment(formData: FormData): Promise<StartOnlinePaymentResult> {
  const validated = await validateGuestBooking(formData)
  if (!validated.ok) return { success: false, error: validated.error }
  const v = validated.value

  const promos = await getPromotions()
  const totalAmount = v.room ? stayTotal(v.room, v.checkIn, v.checkOut, promos) : 0
  if (!(totalAmount > 0)) {
    return { success: false, error: 'Something went wrong pricing this stay. Please try again.' }
  }

  const reference = newOnlinePaymentReference()
  const createdAt = new Date().toISOString()

  // Service-role insert: this row is updated again on confirmation, which
  // anon can't do.
  const { error } = await supabaseAdmin.from('Bookings').insert({
    id: crypto.randomUUID(),
    room_id: v.roomId,
    guest_name: v.guestName,
    guest_phone: v.guestPhone,
    guest_email: v.guestEmail,
    check_in: v.checkIn,
    check_out: v.checkOut,
    status: 'pending', // becomes 'confirmed' only once the payment is verified
    source: 'online',
    payment_method: 'card',
    payment_status: 'unpaid',
    payment_option: 'pay_online',
    online_payment_reference: reference,
    total_amount: totalAmount,
    amount_paid: 0,
    card_consent_at: createdAt,
    card_consent_policy_version: v.cardConsentPolicyVersion,
    card_email: v.guestEmail,
    created_at: createdAt,
    special_requests: v.specialRequests,
  })

  if (error) {
    console.error('Pending online booking insert failed:', error)
    return { success: false, error: 'Something went wrong. Please try again.' }
  }

  return { success: true, reference, amountKobo: nairaToKobo(totalAmount), email: v.guestEmail }
}

export type ConfirmOnlinePaymentResult =
  | { success: true; bookingId: string; createdAt: string; amountPaid: number }
  | { success: false; error: string }

/**
 * Pay online, step 2: called by the browser once the Paystack popup
 * reports success. Takes only the reference — everything else (amount,
 * currency, which booking) is checked server-side against Paystack and our
 * own row. See finalizeOnlinePayment in src/lib/onlinePayments.ts.
 */
export async function confirmOnlinePayment(reference: string): Promise<ConfirmOnlinePaymentResult> {
  const result = await finalizeOnlinePayment(reference)
  if (!result.ok) return { success: false, error: result.error }
  return {
    success: true,
    bookingId: result.bookingId,
    createdAt: result.createdAt,
    amountPaid: result.totalAmount,
  }
}
