// Server-only helpers for recomputing a booking's total and payment
// status — shared by the admin booking actions
// (src/app/admin/bookings/actions.ts) and the promotions actions
// (src/app/admin/promotions/actions.ts). Kept out of those 'use server'
// files on purpose: every export of a 'use server' file becomes a
// publicly callable server action, and these must only ever be called
// from server code that has already checked what it's doing.

import type { createClient } from '@/lib/supabase/server'
import { computePaymentStatus, resolveTotalAmount } from '@/lib/bookingStatus'
import { bookingTotal } from '@/lib/pricing'

type ActionResult = { success: true } | { success: false; error: string }
type StaffClient = Awaited<ReturnType<typeof createClient>>

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
export async function recalculateBookingTotals(
  supabase: StaffClient,
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
    .select('total_amount, check_in, check_out, Rooms(name, price_per_night)')
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


// PostgREST surfaces an unknown column differently depending on where it
// appears in the request: a SELECT referencing one gets the raw Postgres
// error (42703, "column does not exist"), while an INSERT/UPDATE payload
// key gets PostgREST's OWN schema-cache check instead (PGRST204, "Could
// not find the X column ... in the schema cache") — confirmed by testing
// both against this exact database. Both mean the same thing here
// (cancelled_at doesn't exist yet), so both are treated as retry-without
// the column rather than a real failure.
export const MISSING_COLUMN_ERROR_CODES = new Set(['42703', 'PGRST204'])
export function isMissingColumnError(error: { code?: string } | null | undefined): boolean {
  return Boolean(error?.code && MISSING_COLUMN_ERROR_CODES.has(error.code))
}

export type Adjustments = {
  early_checkin_fee: number | null
  late_checkout_fee: number | null
  discount_amount: number | null
  discount_percent: number | null
}

export const NO_ADJUSTMENTS: Adjustments = {
  early_checkin_fee: null,
  late_checkout_fee: null,
  discount_amount: null,
  discount_percent: null,
}

export const num = (v: unknown) => (v != null ? Number(v) : null)

/**
 * Everything on a booking that sits on top of the room total: early
 * check-in / late check-out fees and any staff discount. Fetched on its
 * own, rather than added to every select string that recomputes a total,
 * so that on a database where the newer migrations haven't been run yet
 * those recomputations (edit dates, change room, early checkout) keep
 * working — they just see no fees/discount — instead of failing outright
 * on an unknown column, the same posture as cancelled_at above. Tries
 * fees + discount, then fees only (20261028 run but not 20261030).
 */
export async function fetchAdjustments(
  supabase: StaffClient,
  bookingId: string
): Promise<Adjustments> {
  const full = await supabase
    .from('Bookings')
    .select('early_checkin_fee, late_checkout_fee, discount_amount, discount_percent')
    .eq('id', bookingId)
    .single()
  if (!full.error && full.data) {
    return {
      early_checkin_fee: num(full.data.early_checkin_fee),
      late_checkout_fee: num(full.data.late_checkout_fee),
      discount_amount: num(full.data.discount_amount),
      discount_percent: num(full.data.discount_percent),
    }
  }
  if (!isMissingColumnError(full.error)) {
    if (full.error) console.error('fetchAdjustments failed:', full.error)
    return NO_ADJUSTMENTS
  }
  const feesOnly = await supabase
    .from('Bookings')
    .select('early_checkin_fee, late_checkout_fee')
    .eq('id', bookingId)
    .single()
  if (feesOnly.error || !feesOnly.data) {
    if (feesOnly.error && !isMissingColumnError(feesOnly.error)) {
      console.error('fetchAdjustments failed:', feesOnly.error)
    }
    return NO_ADJUSTMENTS
  }
  return {
    ...NO_ADJUSTMENTS,
    early_checkin_fee: num(feesOnly.data.early_checkin_fee),
    late_checkout_fee: num(feesOnly.data.late_checkout_fee),
  }
}

/**
 * A booking's new total for a given room total, plus the column update
 * that keeps a PERCENTAGE discount's stored amount in sync (10% of a
 * changed room total is a changed amount). Spread `discountUpdate` into
 * the same .update() that writes total_amount — it's empty unless a
 * percentage discount exists, so it never references the discount
 * columns on a database that doesn't have them.
 */
export function priceWithAdjustments(
  roomTotal: number,
  adjustments: Adjustments
): { total: number; discountUpdate: { discount_amount?: number } } {
  const { total, discount } = bookingTotal(roomTotal, adjustments)
  return {
    total,
    discountUpdate: adjustments.discount_percent != null ? { discount_amount: discount } : {},
  }
}
