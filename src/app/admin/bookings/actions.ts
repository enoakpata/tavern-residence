'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { bookingsQuery } from '@/lib/adminBookings'
import { isRoomAvailable, getChargeableAuthCode, ACTIVE_BOOKING_STATUSES } from '@/lib/bookings'
import { computePaymentStatus, resolveTotalAmount, isBookingLocked } from '@/lib/bookingStatus'
import { paymentMomentForDate, todayInLagos } from '@/lib/dateUtils'
import { chargeAuthorization } from '@/lib/paystack'
import {
  sendEmail,
  buildGuestConfirmationEmail,
  buildCancellationNotificationEmail,
  buildChargeReceiptEmail,
} from '@/lib/email'
import type { Room, BookingPayment, BookingPaymentMethod } from '@/lib/types'
import { HOTEL_EMAIL } from '@/lib/siteConfig'
import { displayRoomName } from '@/lib/roomTypeContent'

type ActionResult = { success: true } | { success: false; error: string }

const LOCKED_ERROR = 'This booking is cancelled and can no longer be changed.'

// Only these two are offered in the Record Payment and New Booking forms
// now (point 2 of the payments follow-up) — the booking_payments CHECK
// constraint stays broader so historical rows (cash/card/other, or a
// saved-card charge's 'card') keep displaying and nothing already
// written needs to change.
const RECORDABLE_METHODS: BookingPaymentMethod[] = ['pos', 'transfer']

/**
 * Nights between two ISO dates — duplicated from the same small helper
 * already repeated per-file elsewhere (BookingForm.tsx, etc.) rather than
 * a shared util, matching that existing convention.
 */
function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime()
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)))
}

/**
 * Recomputes amount_paid and payment_status from the actual ledger
 * (booking_payments) rather than incrementing a counter by hand — the
 * ledger is the single source of truth, so every write path (record,
 * void, saved-card charge) calls this afterward instead of separately
 * tracking a running total that could drift out of sync. Resolves the
 * total via resolveTotalAmount (total_amount, falling back to nights ×
 * price_per_night) — the SAME resolution the Payments section displays —
 * rather than the raw, sometimes-null total_amount column alone, which
 * was the root cause of a booking showing "Paid in full" while still
 * badged "Partial" (no ceiling to compare against).
 */
async function recalculateBookingTotals(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookingId: string
): Promise<ActionResult> {
  const { data: payments, error: paymentsError } = await supabase
    .from('booking_payments')
    .select('amount, status')
    .eq('booking_id', bookingId)

  if (paymentsError) return { success: false, error: paymentsError.message }

  const amountPaid = (payments ?? [])
    .filter((p) => p.status === 'success')
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const { data: booking, error: bookingError } = await supabase
    .from('Bookings')
    .select('total_amount, check_in, check_out, Rooms(price_per_night)')
    .eq('id', bookingId)
    .single()

  if (bookingError || !booking) {
    return { success: false, error: bookingError?.message ?? 'Booking not found.' }
  }

  // Bookings -> Rooms is many-to-one; PostgREST returns a single embedded
  // object at runtime, but without generated schema types supabase-js
  // sometimes infers it as an array depending on the select shape.
  const room = Array.isArray(booking.Rooms) ? booking.Rooms[0] : booking.Rooms
  const totalAmount = resolveTotalAmount(booking, room)
  const paymentStatus = computePaymentStatus(amountPaid, totalAmount)

  const { error } = await supabase
    .from('Bookings')
    .update({ amount_paid: amountPaid, payment_status: paymentStatus })
    .eq('id', bookingId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

const NON_CANCELLABLE_STATUSES = ['cancelled', 'checked_out', 'no_show']

/**
 * Fetches one booking's full detail (every field, plus its room) for the
 * "View" detail panel — shared by both the bookings table and the
 * notification dropdown, which only ever has a booking_id on hand, not a
 * full row already in memory. Uses the same bookingsQuery() the table and
 * Today's Check-ins/Check-outs pages already share, so this view can never
 * show a different shape of data than either of those.
 *
 * A server action's return value is serialized to the client like any
 * other prop — this strips the two actual card tokens
 * (card_authorization_code, the legacy payment_token) out of what's sent,
 * replacing them with derived booleans the UI actually needs
 * (has_card_on_file, card_chargeable). Anything that needs to charge the
 * card looks the token up itself, server-side, by booking id (see
 * chargeSavedCard above) — it never flows through this client-visible
 * object.
 *
 * Doesn't use the shared bookingsQuery()/BOOKINGS_WITH_ROOM_SELECT (which
 * selects every column via '*') — the admin UI no longer displays card
 * details or consent at all, so card_last4/card_brand/card_exp/
 * card_consent_at/card_email/card_consent_policy_version aren't selected
 * here in the first place, not just hidden client-side. card_reusable is
 * still selected (needed to compute card_chargeable below) but stripped
 * before returning, same as the two token fields.
 *
 * cancelled_at (supabase/migrations/20261015_add_cancelled_at_and_resync_payments.sql)
 * is requested but NOT assumed to exist — on a database where that
 * migration hasn't been run yet, selecting an unknown column fails the
 * whole query (Postgres 42703, "column does not exist"), which used to
 * surface here as "Couldn't load this booking" for every single booking,
 * not just cancelled ones. If that specific error comes back, this
 * retries once without cancelled_at so the rest of the detail view keeps
 * working; the "cancelled at" timestamp just won't show until the
 * migration is actually applied.
 */
const BOOKING_DETAIL_COLUMNS =
  'id, room_id, guest_name, guest_phone, guest_email, check_in, check_out, status, source, payment_status, charge_type, amount_charged, created_by, created_at, reminder_sent, special_requests, total_amount, amount_paid, payment_token, card_authorization_code, card_reusable, Rooms(room_number, name, room_type, price_per_night)'

// PostgREST surfaces an unknown column differently depending on where it
// appears in the request: a SELECT referencing one gets the raw Postgres
// error (42703, "column does not exist"), while an INSERT/UPDATE payload
// key gets PostgREST's OWN schema-cache check instead (PGRST204, "Could
// not find the X column ... in the schema cache") — confirmed by testing
// both against this exact database. Both mean the same thing here
// (cancelled_at doesn't exist yet), so both are treated as retry-without
// the column rather than a real failure.
const MISSING_COLUMN_ERROR_CODES = new Set(['42703', 'PGRST204'])
function isMissingColumnError(error: { code?: string } | null | undefined): boolean {
  return Boolean(error?.code && MISSING_COLUMN_ERROR_CODES.has(error.code))
}

export type GetBookingDetailResult =
  | { status: 'ok'; booking: NonNullable<Awaited<ReturnType<typeof fetchBookingDetailRow>>> }
  | { status: 'not_found' }
  | { status: 'error' }

async function fetchBookingDetailRow(bookingId: string) {
  const supabase = await createClient()

  let { data, error } = await supabase
    .from('Bookings')
    .select(`${BOOKING_DETAIL_COLUMNS}, cancelled_at`)
    .eq('id', bookingId)
    .single()

  if (isMissingColumnError(error)) {
    const retry = await supabase
      .from('Bookings')
      .select(BOOKING_DETAIL_COLUMNS)
      .eq('id', bookingId)
      .single()
    data = retry.data ? { ...retry.data, cancelled_at: null } : null
    error = retry.error
  }

  if (error) {
    console.error('getBookingDetail query failed:', {
      bookingId,
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
    throw error
  }
  if (!data) return null

  const { payment_token, card_authorization_code, card_reusable, ...safe } = data
  return {
    ...safe,
    has_card_on_file: Boolean(payment_token ?? card_authorization_code),
    card_chargeable: Boolean(payment_token ?? card_authorization_code) && card_reusable !== false,
  }
}

export async function getBookingDetail(bookingId: string): Promise<GetBookingDetailResult> {
  try {
    const booking = await fetchBookingDetailRow(bookingId)
    if (!booking) return { status: 'not_found' }
    return { status: 'ok', booking }
  } catch {
    // Already logged with full detail inside fetchBookingDetailRow — this
    // catch only decides what the client sees (a generic failure, not
    // the raw Postgres error) and keeps a thrown query error from ever
    // reaching the client as an unhandled rejection.
    return { status: 'error' }
  }
}

export type CreateManualBookingResult =
  | { success: true }
  | { success: false; error: string; overpayment?: boolean }

/**
 * Manual booking entry — used for walk-ins and phone bookings. Unlike the
 * guest-facing form, there's no Paystack card verification here: a walk-in
 * pays at the front desk (POS or cash), and a phone booking either pays by
 * transfer or the receptionist takes card details over a payment link
 * outside this system entirely.
 *
 * An amount paid at booking time is optional — if given, it's recorded as
 * the booking's first booking_payments row in the same operation. There's
 * no real multi-statement transaction available over PostgREST, so this
 * is a compensating rollback instead: if the ledger insert fails after
 * the booking insert already succeeded, the just-created booking is
 * deleted and a clean error returned, rather than leaving a booking on
 * file that claims a payment with no ledger row behind it.
 */
export async function createManualBooking(formData: FormData): Promise<CreateManualBookingResult> {
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

  const amountPaidRaw = (formData.get('amount_paid') as string) || ''
  const amountPaid = amountPaidRaw ? Number(amountPaidRaw) : 0
  const paymentMethod = ((formData.get('payment_method') as string) || 'transfer') as BookingPaymentMethod
  const paymentDate = (formData.get('payment_date') as string) || todayInLagos()
  const allowOverpayment = formData.get('allow_overpayment') === 'true'

  if (!roomId || !guestName || !guestPhone || !checkIn || !checkOut || !source) {
    return { success: false, error: 'Please fill in all required fields.' }
  }
  if (checkOut <= checkIn) {
    return { success: false, error: 'Check-out must be after check-in.' }
  }
  if (amountPaid < 0 || Number.isNaN(amountPaid)) {
    return { success: false, error: 'Amount paid cannot be negative.' }
  }
  if (amountPaid > 0 && !RECORDABLE_METHODS.includes(paymentMethod)) {
    return { success: false, error: 'Choose a valid payment method.' }
  }

  const available = await isRoomAvailable(roomId, checkIn, checkOut)
  if (!available) {
    return { success: false, error: 'This room is not available for those dates.' }
  }

  const { data: room } = await supabase
    .from('Rooms')
    .select('price_per_night')
    .eq('id', roomId)
    .single()
  const totalAmount = (room?.price_per_night ?? 0) * nightsBetween(checkIn, checkOut)

  if (amountPaid > totalAmount && !allowOverpayment) {
    return {
      success: false,
      error: `This is more than the total (₦${totalAmount.toLocaleString()}).`,
      overpayment: true,
    }
  }

  // Generated up front (rather than left to the DB default) so it's
  // available below for the guest's "manage your booking" email link,
  // matching the same pattern the guest-facing booking flow already uses.
  const bookingId = crypto.randomUUID()
  const paymentStatus = computePaymentStatus(amountPaid, totalAmount)

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
    total_amount: totalAmount,
    amount_paid: amountPaid,
    created_by: user?.email ?? null,
  })

  if (error) {
    console.error('Manual booking insert failed:', error)
    return { success: false, error: 'Something went wrong. Please try again.' }
  }

  if (amountPaid > 0) {
    // Same date-handling rule as recordPayment: the actual recorded
    // instant, not a UTC-midnight stand-in for the chosen calendar date.
    const { error: ledgerError } = await supabase.from('booking_payments').insert({
      booking_id: bookingId,
      amount: amountPaid,
      method: paymentMethod,
      type: 'payment',
      note: 'Collected at booking (manual entry)',
      recorded_by: user?.email ?? null,
      status: 'success',
      created_at: paymentMomentForDate(paymentDate),
    })
    if (ledgerError) {
      console.error('Manual booking ledger entry failed, rolling back booking:', ledgerError)
      await supabase.from('Bookings').delete().eq('id', bookingId)
      return {
        success: false,
        error: 'Something went wrong recording the payment. Please try again.',
      }
    }
  }

  // Booking is already recorded at this point — email is a nice-to-have on
  // top, so a failure here must never turn a successful booking into an
  // error response. Staff already know a booking came in (they just
  // created it), so only the guest gets emailed here.
  if (guestEmail) {
    try {
      const { data: roomData } = await supabase
        .from('Rooms')
        .select('name')
        .eq('id', roomId)
        .single()
      const roomName = displayRoomName(roomData?.name, 'your room')

      const guestEmailContent = buildGuestConfirmationEmail({
        guestName,
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

export type RecordPaymentResult =
  | { success: true }
  | { success: false; error: string; overpayment?: boolean }

/**
 * Appends a manual payment (POS or transfer) to a booking's ledger — the
 * primary way a stay gets marked paid now, replacing the old single
 * "Mark as paid" toggle. Works just as well for a partial payment (e.g. 2
 * weeks of a month-long stay) as a full one; payment_status is derived
 * from the ledger total afterward, never set directly here.
 */
export async function recordPayment(
  bookingId: string,
  input: {
    amount: number
    method: BookingPaymentMethod
    note: string
    date?: string
    // Set once the admin has seen the overpayment warning this function
    // returns on a first attempt and chosen to proceed anyway.
    allowOverpayment?: boolean
  }
): Promise<RecordPaymentResult> {
  if (!(input.amount > 0)) {
    return { success: false, error: 'Enter a payment amount greater than zero.' }
  }
  if (!RECORDABLE_METHODS.includes(input.method)) {
    return { success: false, error: 'Choose a valid payment method.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: booking, error: fetchError } = await supabase
    .from('Bookings')
    .select('status, total_amount, amount_paid, check_in, check_out, Rooms(price_per_night)')
    .eq('id', bookingId)
    .single()

  if (fetchError || !booking) {
    return { success: false, error: 'Booking not found.' }
  }
  if (isBookingLocked(booking)) {
    return { success: false, error: LOCKED_ERROR }
  }

  const room = Array.isArray(booking.Rooms) ? booking.Rooms[0] : booking.Rooms
  const totalAmount = resolveTotalAmount(booking, room)
  const newAmountPaid = Number(booking.amount_paid) + input.amount
  if (newAmountPaid > totalAmount && !input.allowOverpayment) {
    const over = newAmountPaid - totalAmount
    return {
      success: false,
      error: `This exceeds the remaining balance by ₦${over.toLocaleString()}.`,
      overpayment: true,
    }
  }

  // The chosen calendar date (today or a past date, never future — see
  // DateRangePicker's allowPast/maxDate) maps to an actual stored instant
  // via paymentMomentForDate: "now" if today, otherwise midday Africa/
  // Lagos on that date — never midnight, which previously displayed as
  // 1:00 AM once read back in Lagos time.
  const { error } = await supabase.from('booking_payments').insert({
    booking_id: bookingId,
    amount: input.amount,
    method: input.method,
    type: 'payment',
    note: input.note || null,
    recorded_by: user?.email ?? null,
    status: 'success',
    ...(input.date ? { created_at: paymentMomentForDate(input.date) } : {}),
  })
  if (error) return { success: false, error: error.message }

  const totalsResult = await recalculateBookingTotals(supabase, bookingId)
  if (!totalsResult.success) return totalsResult

  revalidatePath('/admin/bookings')
  revalidatePath('/admin/check-in/check-out')
  return { success: true }
}

/**
 * Reverses a ledger entry without deleting it — inserts a new,
 * negative-amount row referencing the original, so the full history stays
 * intact (booking_payments has no update/delete RLS policy at all; this
 * is the only way to "undo" an entry). Only a successful entry can be
 * voided — a failed charge attempt has already affected nothing to
 * reverse.
 */
export async function voidPayment(
  bookingId: string,
  paymentId: string,
  note: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: booking, error: bookingFetchError } = await supabase
    .from('Bookings')
    .select('status')
    .eq('id', bookingId)
    .single()

  if (bookingFetchError || !booking) {
    return { success: false, error: 'Booking not found.' }
  }
  if (isBookingLocked(booking)) {
    return { success: false, error: LOCKED_ERROR }
  }

  const { data: original, error: fetchError } = await supabase
    .from('booking_payments')
    .select('*')
    .eq('id', paymentId)
    .eq('booking_id', bookingId)
    .single()

  if (fetchError || !original) {
    return { success: false, error: 'Payment not found.' }
  }
  if (original.status !== 'success') {
    return { success: false, error: 'Only a successful payment can be voided.' }
  }

  const { error } = await supabase.from('booking_payments').insert({
    booking_id: bookingId,
    amount: -Number(original.amount),
    method: original.method,
    type: 'refund',
    reference: original.id,
    note:
      note ||
      `Void of ${original.type.replace('_', ' ')} from ${new Date(original.created_at).toLocaleDateString()}`,
    recorded_by: user?.email ?? null,
    status: 'success',
  })
  if (error) return { success: false, error: error.message }

  const totalsResult = await recalculateBookingTotals(supabase, bookingId)
  if (!totalsResult.success) return totalsResult

  revalidatePath('/admin/bookings')
  revalidatePath('/admin/check-in/check-out')
  return { success: true }
}

export type GetBookingPaymentsResult = { payments: BookingPayment[]; failed: boolean }

/**
 * Most-recent-first payment history for a booking's Payments section.
 * Returns `failed: true` on a real query error (distinct from a booking
 * that genuinely has no payments yet) — PaymentsSection.tsx shows a
 * "Couldn't load payments" note in that case rather than silently
 * reading as "No payments recorded yet", and the rest of the booking
 * detail view still renders regardless, since this never throws.
 */
export async function getBookingPayments(bookingId: string): Promise<GetBookingPaymentsResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('booking_payments')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getBookingPayments failed:', {
      bookingId,
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
    return { payments: [], failed: true }
  }
  return { payments: (data ?? []) as BookingPayment[], failed: false }
}

export type ChargeSavedCardReason = 'cancellation_fee' | 'no_show' | 'other'

const CHARGE_REASON_LABELS: Record<ChargeSavedCardReason, string> = {
  cancellation_fee: 'Cancellation fee',
  no_show: 'No-show fee',
  other: 'Other charge',
}

/**
 * Charges the card verified and held at booking time — for a
 * cancellation, no-show, or other fee only, never for the stay itself
 * (that's paid manually and tracked via recordPayment). Looks up the
 * authorization code and guest email SERVER-SIDE by booking id — the
 * client only ever supplies bookingId/amount/reason/note, never the card
 * token itself, so it can't appear in a client bundle or a server
 * action's request payload. Never retried automatically: a failure is
 * recorded (status 'failed', balance untouched) and returned to the
 * admin to decide what to do next.
 */
export async function chargeSavedCard(
  bookingId: string,
  amountNaira: number,
  reason: ChargeSavedCardReason,
  note: string
): Promise<ActionResult> {
  if (!(amountNaira > 0)) {
    return { success: false, error: 'Enter an amount greater than zero.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: booking, error: fetchError } = await supabase
    .from('Bookings')
    .select('card_authorization_code, payment_token, card_reusable, card_email, guest_email, guest_name, card_last4')
    .eq('id', bookingId)
    .single()

  if (fetchError || !booking) {
    return { success: false, error: 'Booking not found.' }
  }

  // card_reusable is only ever explicitly false for a card we know for
  // certain can't be charged again; null/undefined covers bookings made
  // before this field existed, where the legacy payment_token may still
  // be perfectly chargeable — only a confirmed-false blocks the attempt.
  const authCode = getChargeableAuthCode(booking)
  if (!authCode || booking.card_reusable === false) {
    return { success: false, error: 'No chargeable card on file for this booking.' }
  }
  const email = booking.card_email ?? booking.guest_email
  if (!email) {
    return { success: false, error: 'No email on file to run this charge.' }
  }

  const reasonLabel = CHARGE_REASON_LABELS[reason]
  const fullNote = note ? `${reasonLabel}: ${note}` : reasonLabel

  const result = await chargeAuthorization(authCode, amountNaira, email)

  // booking_payments.type only has 3 values (payment/cancellation_fee/
  // refund) — a no-show or "other" charge is still recorded as
  // cancellation_fee (the only non-payment charge type), with the real
  // reason kept in the note text instead.
  const { error: ledgerError } = await supabase.from('booking_payments').insert({
    booking_id: bookingId,
    amount: amountNaira,
    method: 'card',
    type: 'cancellation_fee',
    reference: result.success ? result.reference : null,
    note: fullNote,
    recorded_by: user?.email ?? null,
    status: result.success ? 'success' : 'failed',
  })
  if (ledgerError) {
    console.error('Charge ledger entry failed:', ledgerError)
  }

  if (!result.success) {
    return { success: false, error: result.error ?? 'Charge failed.' }
  }

  const totalsResult = await recalculateBookingTotals(supabase, bookingId)
  if (!totalsResult.success) return totalsResult

  // Best-effort receipt — an email failure must never undo or hide an
  // already-successful charge.
  try {
    await sendEmail({
      to: email,
      ...buildChargeReceiptEmail({
        guestName: booking.guest_name,
        amount: amountNaira,
        reasonLabel,
        cardLast4: booking.card_last4 ?? '',
      }),
    })
  } catch (emailError) {
    console.error('Charge receipt email failed to send:', emailError)
  }

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

  const { data: booking, error: fetchError } = await supabase
    .from('Bookings')
    .select('status')
    .eq('id', bookingId)
    .single()

  if (fetchError || !booking) {
    return { success: false, error: 'Booking not found.' }
  }
  if (isBookingLocked(booking)) {
    return { success: false, error: LOCKED_ERROR }
  }

  const { error } = await supabase
    .from('Bookings')
    .update({ status })
    .eq('id', bookingId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/bookings')
  revalidatePath('/admin/check-in/check-out')
  return { success: true }
}

/**
 * Edits an existing booking's stay dates. A 'confirmed' booking (guest
 * hasn't arrived yet) can have both dates changed; a 'checked_in' one can
 * only have its check-out moved, since check-in already happened and no
 * longer reflects a future action — enforced here too, not just hidden
 * from the form, in case the client sends a stale check-in.
 *
 * Doesn't touch payment in any way: staff collect any payment difference
 * entirely outside the system (cash, POS, transfer), the same way a
 * walk-in pays today. The only guard is availability, checked against
 * every OTHER booking for the room — this booking's own current dates are
 * excluded via isRoomAvailable's excludeBookingId, so it never conflicts
 * with itself.
 */
export async function editBookingDates(
  bookingId: string,
  newCheckIn: string,
  newCheckOut: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: booking, error: fetchError } = await supabase
    .from('Bookings')
    .select('room_id, check_in, check_out, status')
    .eq('id', bookingId)
    .single()

  if (fetchError || !booking) {
    return { success: false, error: 'Booking not found.' }
  }
  if (isBookingLocked(booking)) {
    return { success: false, error: LOCKED_ERROR }
  }

  if (!['confirmed', 'checked_in'].includes(booking.status)) {
    return {
      success: false,
      error: 'Only a confirmed or currently checked-in booking can have its dates edited.',
    }
  }

  if (booking.status === 'checked_in' && newCheckIn !== booking.check_in) {
    return { success: false, error: "Check-in can't be changed once a guest has checked in." }
  }

  if (newCheckOut <= newCheckIn) {
    return { success: false, error: 'Check-out must be after check-in.' }
  }

  const available = await isRoomAvailable(booking.room_id, newCheckIn, newCheckOut, bookingId)
  if (!available) {
    return {
      success: false,
      error: 'This room is already booked for part of that range. Choose different dates.',
    }
  }

  const { error } = await supabase
    .from('Bookings')
    .update({ check_in: newCheckIn, check_out: newCheckOut })
    .eq('id', bookingId)

  if (error) return { success: false, error: 'Something went wrong. Please try again.' }

  revalidatePath('/admin/bookings')
  revalidatePath('/admin/check-in/check-out')
  revalidatePath('/admin/calendar')
  return { success: true }
}

/**
 * Fetches the date ranges that currently block a booking's room — the
 * same "pending"/"confirmed"/"checked_in" statuses isRoomAvailable()
 * treats as blocking — so the "Edit dates" calendar can grey out
 * already-booked dates up front, the same way the guest-facing room page
 * already does. Excludes the booking being edited itself, the same
 * exclusion isRoomAvailable() applies via its excludeBookingId parameter,
 * so a booking's own current stay never shows as blocked on its own edit
 * calendar.
 */
export async function getRoomBlockedRangesForEdit(
  bookingId: string
): Promise<{ checkIn: string; checkOut: string }[]> {
  const supabase = await createClient()
  const { data: booking, error: fetchError } = await supabase
    .from('Bookings')
    .select('room_id')
    .eq('id', bookingId)
    .single()

  if (fetchError || !booking) return []

  const { data, error } = await supabase
    .from('Bookings')
    .select('check_in, check_out')
    .eq('room_id', booking.room_id)
    .in('status', ACTIVE_BOOKING_STATUSES)
    .neq('id', bookingId)

  if (error || !data) return []

  return data.map((b) => ({ checkIn: b.check_in as string, checkOut: b.check_out as string }))
}

const CANCELLABLE_STATUSES = ['pending', 'confirmed']

export type CancelBookingResult =
  | { success: true; feeCharged: boolean; feeAmount: number; chargeError?: string }
  | { success: false; error: string }

/**
 * Staff-initiated cancellation from the admin dashboard — mirrors the
 * guest-facing cancelBooking action (src/app/(site)/booking/[id]/actions.ts)
 * but runs under the authenticated admin session instead of the
 * service-role client, and revalidates the admin bookings page instead of
 * the guest's manage-booking page.
 *
 * Never charges automatically — `feeAmount` is an explicit figure the
 * admin confirms in the UI (BookingActions.tsx pre-fills it from the
 * cancellation policy's suggested fee but lets the admin edit or zero it
 * out before confirming). 0 (or any booking with no chargeable card on
 * file, regardless of what's passed) cancels without a charge.
 *
 * Idempotency: the cancellation itself is CLAIMED atomically (a single
 * UPDATE ... WHERE status IN (cancellable)) before any charge is
 * attempted — Postgres only lets one such UPDATE match a given row at a
 * time, so a double-click or a retried request that races this function
 * a second time finds the row no longer matches that WHERE clause and is
 * refused here, before it could ever charge the fee twice. A plain
 * read-then-write (check status, then separately update it later) would
 * leave a real race window between the two concurrent requests' reads.
 */
export async function cancelBookingByStaff(
  bookingId: string,
  feeAmount: number
): Promise<CancelBookingResult> {
  const supabase = await createClient()

  const { data: booking, error: fetchError } = await supabase
    .from('Bookings')
    .select('*, Rooms(price_per_night, room_number, name)')
    .eq('id', bookingId)
    .single()

  if (fetchError || !booking) {
    return { success: false, error: 'Booking not found.' }
  }
  if (isBookingLocked(booking) || NON_CANCELLABLE_STATUSES.includes(booking.status)) {
    return { success: false, error: 'This booking can no longer be cancelled.' }
  }

  let { data: claimed, error: claimError } = await supabase
    .from('Bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', bookingId)
    .in('status', CANCELLABLE_STATUSES)
    .select('id')
    .maybeSingle()

  // cancelled_at may not exist yet on this database (see
  // getBookingDetail's own comment on the same migration) — retry the
  // SAME atomic, conditional update without it rather than failing the
  // whole cancellation. The "cancelled at" timestamp just won't be
  // recorded until the migration actually runs.
  if (isMissingColumnError(claimError)) {
    const retry = await supabase
      .from('Bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)
      .in('status', CANCELLABLE_STATUSES)
      .select('id')
      .maybeSingle()
    claimed = retry.data
    claimError = retry.error
  }

  if (claimError) {
    console.error('cancelBookingByStaff claim update failed:', {
      bookingId,
      message: claimError.message,
      code: claimError.code,
      details: claimError.details,
      hint: claimError.hint,
    })
    return { success: false, error: 'Something went wrong. Please try again.' }
  }
  if (!claimed) {
    return {
      success: false,
      error: 'This booking was already cancelled by another request — refresh to see its current state.',
    }
  }

  const hasCardOnFile = Boolean(getChargeableAuthCode(booking)) && booking.card_reusable !== false

  if (!(feeAmount > 0) || !hasCardOnFile) {
    await notifyCancellationByEmail(booking, false, 0)
    revalidatePath('/admin/bookings')
    revalidatePath('/admin/check-in/check-out')
    return { success: true, feeCharged: false, feeAmount: 0 }
  }

  // The cancellation is already committed by this point — a declined
  // card below doesn't (and can't) un-cancel the booking, it only means
  // the fee wasn't collected. chargeSavedCard still records the failed
  // attempt in the ledger (status 'failed', balance untouched); staff
  // can log it manually via Record Payment if the guest pays another way
  // — there's no separate "retry the card charge" action any more.
  const chargeResult = await chargeSavedCard(
    bookingId,
    feeAmount,
    'cancellation_fee',
    'Staff cancellation'
  )

  await notifyCancellationByEmail(booking, chargeResult.success, chargeResult.success ? feeAmount : 0)

  revalidatePath('/admin/bookings')
  revalidatePath('/admin/check-in/check-out')

  if (!chargeResult.success) {
    return {
      success: true,
      feeCharged: false,
      feeAmount: 0,
      chargeError: `Booking cancelled, but the card was declined: ${chargeResult.error}. Record the fee manually if the guest pays another way.`,
    }
  }

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
      to: HOTEL_EMAIL,
      ...buildCancellationNotificationEmail({
        guestName: booking.guest_name,
        roomNumber: booking.Rooms?.room_number ?? '',
        roomName: displayRoomName(booking.Rooms?.name, 'the room'),
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
