// Server-only logic for the "Pay online" booking option. Not a
// 'use server' file on purpose — every export of one of those becomes a
// publicly callable server action, and these must only be reached through
// the checked entry points: startOnlinePayment / confirmOnlinePayment
// (src/app/(site)/rooms/[id]/actions.ts), the Paystack webhook
// (src/app/api/paystack/webhook/route.ts), and the admin cancel / no-show
// actions (src/app/admin/bookings/actions.ts).
//
// Lifecycle of a Pay online booking:
//   1. startOnlinePayment inserts it as status 'pending' with a unique
//      online_payment_reference and a server-computed total_amount. The
//      pending row holds the room while the guest is in the Paystack popup.
//   2. finalizeOnlinePayment (called by the guest's browser after the popup
//      reports success AND by the webhook — whichever arrives first) checks
//      the transaction with Paystack and only then confirms the booking.
//      The unique index on booking_payments.reference makes it idempotent.
//   3. If nobody ever pays, expireAbandonedOnlineBookings deletes the hold
//      after ONLINE_PAYMENT_HOLD_MINUTES so the room frees up.
//
// Refunds (refundTransaction) happen ONLY here, and only for technical
// failures: amount/reference/currency mismatch, the room being taken during
// payment, or the hold having already expired. Cancellations and no-shows
// never refund — see convertOnlinePaymentToCredit.

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './supabaseAdmin'
import { getTransaction, refundTransaction, type PaystackTransaction } from './paystack'
import { ACTIVE_BOOKING_STATUSES } from './bookings'
import { recalculateBookingTotals } from './bookingTotals'
import { grantGuestCredit } from './guestCredits'
import { hotelTodayInLagos, todayInLagos } from './dateUtils'
import { sendNewBookingNotifications } from './bookingNotifications'
import { sendEmail, buildOnlineCreditEmail } from './email'

/** How long an unpaid Pay online booking holds the room. */
export const ONLINE_PAYMENT_HOLD_MINUTES = 30

/** The exact text BookingForm.tsx matches to show the "see other rooms" modal. */
export const ROOM_NO_LONGER_AVAILABLE_ERROR = 'This room is no longer available for those dates.'

export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100)
}

export function newOnlinePaymentReference(): string {
  return `tavern_online_${crypto.randomUUID().replace(/-/g, '')}`
}

const UNIQUE_VIOLATION = '23505'
const FOREIGN_KEY_VIOLATION = '23503'

// =====================================================================
// Abandoned holds
// =====================================================================

// Availability checks call this on every request; it only actually runs
// the cleanup query at most this often per server instance.
const EXPIRY_THROTTLE_MS = 30 * 1000
let lastExpiryRun = 0

/**
 * Frees rooms held by Pay online bookings that were never paid (popup
 * closed, card declined, tab closed). Called lazily at the start of every
 * availability check (src/lib/bookings.ts) and the room page's
 * blocked-dates query, so a stale hold is gone before anyone asks whether
 * the room is free — no cron needed.
 *
 * Before deleting a hold it asks Paystack about its reference: if the
 * payment actually went through (our verify call and the webhook both
 * failed), it confirms the booking instead of throwing the payment away.
 * A transaction Paystack still reports as in progress is left alone until
 * it's twice as old as the hold.
 */
export async function expireAbandonedOnlineBookings(): Promise<void> {
  const now = Date.now()
  if (now - lastExpiryRun < EXPIRY_THROTTLE_MS) return
  lastExpiryRun = now

  const cutoff = new Date(now - ONLINE_PAYMENT_HOLD_MINUTES * 60 * 1000).toISOString()
  const { data: stale, error } = await supabaseAdmin
    .from('Bookings')
    .select('id, online_payment_reference, created_at')
    .eq('status', 'pending')
    .eq('payment_option', 'pay_online')
    .lt('created_at', cutoff)
    .limit(20)

  if (error) {
    // Most likely the 20261124 migration hasn't been run yet (no
    // payment_option column) — nothing to expire in that case.
    console.error('expireAbandonedOnlineBookings query failed:', error.message)
    return
  }

  for (const row of stale ?? []) {
    const reference = row.online_payment_reference as string | null
    const tx = reference ? await getTransaction(reference) : null

    if (tx?.status === 'success') {
      await finalizeOnlinePayment(reference as string, tx)
      continue
    }

    const inProgress = tx && ['ongoing', 'pending', 'processing', 'queued'].includes(tx.status)
    const ageMs = now - new Date(row.created_at as string).getTime()
    if (inProgress && ageMs < 2 * ONLINE_PAYMENT_HOLD_MINUTES * 60 * 1000) continue

    await deletePendingHold(row.id as string)
  }
}

/**
 * Deletes an unpaid Pay online hold — only while it's still 'pending', so
 * it can never remove a booking that another request just confirmed.
 * Returns true if this call is the one that removed it.
 */
async function deletePendingHold(bookingId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('Bookings')
    .delete()
    .eq('id', bookingId)
    .eq('status', 'pending')
    .eq('payment_option', 'pay_online')
    .select('id')
  if (error) {
    console.error('Deleting abandoned online booking failed:', bookingId, error.message)
    return false
  }
  return (data ?? []).length > 0
}

// =====================================================================
// Confirming a payment
// =====================================================================

export type FinalizeResult =
  | {
      ok: true
      bookingId: string
      createdAt: string
      totalAmount: number
      // True when another request (usually the webhook) had already
      // confirmed it — the caller still shows the guest success.
      alreadyConfirmed: boolean
    }
  | {
      ok: false
      code: 'not_paid' | 'mismatch' | 'room_taken' | 'expired' | 'error'
      error: string
    }

type PendingOnlineBooking = {
  id: string
  room_id: string
  guest_name: string
  guest_phone: string
  guest_email: string
  check_in: string
  check_out: string
  status: string
  created_at: string
  total_amount: number | null
  online_payment_reference: string
}

async function refundTechnicalFailure(tx: PaystackTransaction, why: string) {
  console.error(`Refunding online payment ${tx.reference} (${why})`)
  const result = await refundTransaction(tx.transactionId)
  if (!result.success) {
    console.error(`REFUND FAILED for ${tx.reference} — refund it manually in the Paystack dashboard.`)
  }
}

/**
 * Other bookings that genuinely conflict with this one: any active booking
 * on the same room overlapping [check_in, check_out), EXCEPT a newer
 * unpaid Pay online hold — this booking's own hold came first, so two
 * guests racing for the same room never both get refunded.
 */
async function hasConflictingBooking(booking: PendingOnlineBooking): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('Bookings')
    .select('id, status, payment_option, created_at')
    .eq('room_id', booking.room_id)
    .in('status', ACTIVE_BOOKING_STATUSES)
    .lt('check_in', booking.check_out)
    .gt('check_out', booking.check_in)
    .neq('id', booking.id)

  // Fail closed, same as isRoomAvailable.
  if (error) {
    console.error('Online payment availability re-check failed:', error.message)
    return true
  }

  return (data ?? []).some(
    (other) =>
      !(
        other.status === 'pending' &&
        other.payment_option === 'pay_online' &&
        (other.created_at as string) > booking.created_at
      )
  )
}

/**
 * Verifies a Pay online payment with Paystack and, only if every check
 * passes, confirms the booking and records the payment. Safe to call any
 * number of times for the same reference, from the guest's browser and the
 * webhook at once: the booking_payments insert is the claim (unique index
 * on reference), so only one caller ever records it or sends the emails.
 *
 * `knownTx` lets a caller that already fetched the transaction skip the
 * second lookup; it's never trusted from outside the server.
 */
export async function finalizeOnlinePayment(
  reference: string,
  knownTx?: PaystackTransaction
): Promise<FinalizeResult> {
  if (!reference) return { ok: false, code: 'not_paid', error: 'Missing payment reference.' }

  const tx = knownTx ?? (await getTransaction(reference))
  if (!tx || tx.status !== 'success') {
    return {
      ok: false,
      code: 'not_paid',
      error: "Your payment didn't go through, so you haven't been charged. Please try again.",
    }
  }

  const { data: bookingRow, error: fetchError } = await supabaseAdmin
    .from('Bookings')
    .select(
      'id, room_id, guest_name, guest_phone, guest_email, check_in, check_out, status, created_at, total_amount, online_payment_reference'
    )
    .eq('online_payment_reference', reference)
    .maybeSingle()

  if (fetchError) {
    console.error('finalizeOnlinePayment lookup failed:', fetchError.message)
    return { ok: false, code: 'error', error: 'Something went wrong confirming your payment. Please contact us.' }
  }

  // Hold already expired and was removed — we can't keep the money for a
  // booking that no longer exists.
  if (!bookingRow) {
    await refundTechnicalFailure(tx, 'booking hold expired before payment was confirmed')
    return {
      ok: false,
      code: 'expired',
      error:
        'Your booking session timed out before the payment was confirmed, so the room was released. Your payment is being refunded in full. Please book again.',
    }
  }

  const booking = bookingRow as PendingOnlineBooking
  const totalAmount = Number(booking.total_amount ?? 0)

  // Already confirmed by an earlier call (e.g. the webhook beat the browser).
  if (booking.status !== 'pending') {
    const { data: existing } = await supabaseAdmin
      .from('booking_payments')
      .select('id')
      .eq('reference', reference)
      .limit(1)
    if ((existing ?? []).length > 0) {
      return { ok: true, bookingId: booking.id, createdAt: booking.created_at, totalAmount, alreadyConfirmed: true }
    }
    return { ok: false, code: 'error', error: 'Something went wrong confirming your payment. Please contact us.' }
  }

  // The checks that decide whether we may keep this money.
  const expectedKobo = nairaToKobo(totalAmount)
  const matches =
    tx.reference === booking.online_payment_reference &&
    tx.currency === 'NGN' &&
    tx.amountKobo === expectedKobo &&
    expectedKobo > 0
  if (!matches) {
    if (await deletePendingHold(booking.id)) {
      await refundTechnicalFailure(
        tx,
        `mismatch: got ${tx.amountKobo} ${tx.currency} ref ${tx.reference}, expected ${expectedKobo} NGN`
      )
    }
    return {
      ok: false,
      code: 'mismatch',
      error:
        "We couldn't match your payment to this booking, so it hasn't been confirmed. Your payment is being refunded in full. Please try again.",
    }
  }

  // Room taken by someone else while the guest was paying.
  if (await hasConflictingBooking(booking)) {
    if (await deletePendingHold(booking.id)) {
      await refundTechnicalFailure(tx, 'room taken during payment')
    }
    return { ok: false, code: 'room_taken', error: ROOM_NO_LONGER_AVAILABLE_ERROR }
  }

  // The claim: only one caller can insert this reference.
  const { error: paymentError } = await supabaseAdmin.from('booking_payments').insert({
    booking_id: booking.id,
    amount: totalAmount,
    method: 'card',
    type: 'payment',
    reference,
    note: 'Paid online (Paystack)',
    recorded_by: 'online',
    status: 'success',
  })

  if (paymentError) {
    if (paymentError.code === UNIQUE_VIOLATION) {
      return { ok: true, bookingId: booking.id, createdAt: booking.created_at, totalAmount, alreadyConfirmed: true }
    }
    if (paymentError.code === FOREIGN_KEY_VIOLATION) {
      // The hold was deleted between our lookup and this insert.
      await refundTechnicalFailure(tx, 'booking hold removed during confirmation')
      return {
        ok: false,
        code: 'expired',
        error:
          'Your booking session timed out before the payment was confirmed, so the room was released. Your payment is being refunded in full. Please book again.',
      }
    }
    // Anything else is transient — don't refund; the webhook or the
    // expiry sweep will retry this same function.
    console.error('Recording online payment failed:', paymentError.message)
    return { ok: false, code: 'error', error: 'Something went wrong confirming your payment. Please contact us — you will not be charged twice.' }
  }

  const auth = tx.authorization
  const cardFields = auth?.authorization_code
    ? {
        payment_token: auth.authorization_code,
        card_authorization_code: auth.authorization_code,
        card_last4: auth.last4 ?? null,
        card_brand: auth.card_type ?? null,
        card_exp: auth.exp_month && auth.exp_year ? `${auth.exp_month}/${auth.exp_year}` : null,
        card_reusable: auth.reusable ?? false,
        card_email: booking.guest_email,
      }
    : {}

  const { error: confirmError } = await supabaseAdmin
    .from('Bookings')
    .update({ status: 'confirmed', ...cardFields })
    .eq('id', booking.id)
  if (confirmError) {
    console.error('Confirming online booking failed (payment IS recorded):', booking.id, confirmError.message)
  }

  const totals = await recalculateBookingTotals(supabaseAdmin, booking.id)
  if (!totals.success) console.error('Recalculating online booking totals failed:', totals.error)

  await sendNewBookingNotifications({
    bookingId: booking.id,
    roomId: booking.room_id,
    guestName: booking.guest_name,
    guestPhone: booking.guest_phone,
    guestEmail: booking.guest_email,
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    createdAt: booking.created_at,
    isSameDayBooking: booking.check_in === hotelTodayInLagos(),
    totalAmount,
    cardLast4: auth?.last4 ?? null,
    paymentOption: 'pay_online',
  })

  return { ok: true, bookingId: booking.id, createdAt: booking.created_at, totalAmount, alreadyConfirmed: false }
}

// =====================================================================
// Cancelled / no-show Pay online booking → guest credit (never a refund)
// =====================================================================

/**
 * Turns everything paid on a cancelled or no-show Pay online booking into
 * guest credit, through the existing credit ledger (grantGuestCredit) — no
 * cancellation fee is ever taken from it. Records an audit entry so the
 * booking's history shows where the money went, and emails the guest.
 *
 * Call it only AFTER the caller has atomically moved the booking to
 * 'cancelled' / 'no_show' (a conditional update that only one request can
 * win), so it runs once per booking.
 *
 * `client`: the staff client in admin actions, supabaseAdmin for the
 * guest's own cancellation (anon can't write guest_credits).
 */
export async function convertOnlinePaymentToCredit(
  client: SupabaseClient,
  booking: {
    id: string
    guest_name: string
    guest_email: string | null
    guest_phone: string | null
    check_in: string
    check_out: string
    amount_paid: number | null
  },
  reason: 'cancelled' | 'no_show',
  performedBy: string | null
): Promise<{ success: true; amount: number } | { success: false; amount: number; error: string }> {
  const amount = Number(booking.amount_paid ?? 0)
  if (!(amount > 0)) return { success: true, amount: 0 }

  const label = reason === 'no_show' ? 'no-show' : 'cancelled'
  const grant = await grantGuestCredit(client, {
    bookingId: booking.id,
    amount,
    guestEmail: booking.guest_email,
    guestPhone: booking.guest_phone,
    note: `Credit from ${label} booking ${booking.id}`,
    performedBy,
    today: todayInLagos(),
  })
  if (!grant.success) return { success: false, amount, error: grant.error }

  const { error: auditError } = await client.from('booking_audit_log').insert({
    booking_id: booking.id,
    event_type: 'online_payment_credit',
    reason: null,
    details: { amount, reason },
    performed_by: performedBy,
  })
  if (auditError) console.error('Audit entry for online payment credit failed:', auditError.message)

  if (booking.guest_email) {
    try {
      await sendEmail({
        to: booking.guest_email,
        ...buildOnlineCreditEmail({
          guestName: booking.guest_name,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          amount,
          reason,
        }),
      })
    } catch (emailError) {
      console.error('Online credit email failed to send:', emailError)
    }
  }

  return { success: true, amount }
}
