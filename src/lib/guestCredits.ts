// Plain guest-credit helpers — no Supabase client import (only a type),
// so the balance math is safe to share between the server code
// that writes guest_credits rows (src/app/admin/bookings/actions.ts,
// src/lib/onlinePayments.ts) and anywhere that just needs to display a
// balance. Fetching/writing the rows themselves is still server-only —
// grantGuestCredit below takes the caller's own Supabase client.

import type { SupabaseClient } from '@supabase/supabase-js'
import { addMonths, parseISODate, toISODate } from './dateUtils'

// How long a credit grant would stay usable before it expires.
//
// EXPIRY IS CURRENTLY DISABLED: grantGuestCredit writes expires_at = null
// (never expires), and supabase/migrations/20261124_pay_online_and_nonexpiring_credit.sql
// cleared it on existing grants. The constant, the expires_at column and
// the expiry check in computeCreditBalance are all kept so it can be
// switched back on later — set CREDIT_EXPIRY_ENABLED to true.
export const CREDIT_EXPIRY_MONTHS = 6
export const CREDIT_EXPIRY_ENABLED = false

export type GuestCreditRow = {
  amount: number
  expires_at: string | null
}

/**
 * A guest's current credit balance: the sum of every ledger row, except
 * an expired grant (a positive row whose expires_at has passed) — a
 * spend row (negative amount, from applying credit as a payment) always
 * counts, and a grant with no expiry (every grant while expiry is
 * disabled) always counts too.
 * Floored at 0 — the ledger itself already prevents a spend from
 * exceeding the balance at write time (see applyGuestCredit in
 * actions.ts), so a negative result here would only mean a data issue,
 * not a real negative balance to display.
 */
export function computeCreditBalance(rows: GuestCreditRow[], today: string): number {
  const total = rows.reduce((sum, row) => {
    const isExpiredGrant = row.amount > 0 && row.expires_at != null && row.expires_at < today
    return isExpiredGrant ? sum : sum + row.amount
  }, 0)
  return Math.max(0, total)
}

/**
 * The expires_at to stamp on a new grant: null while expiry is disabled,
 * otherwise CREDIT_EXPIRY_MONTHS after `today` (an ISO date).
 */
export function creditExpiryFor(today: string): string | null {
  if (!CREDIT_EXPIRY_ENABLED) return null
  return toISODate(addMonths(parseISODate(today), CREDIT_EXPIRY_MONTHS))
}

/**
 * The one place a credit GRANT (positive guest_credits row) is written —
 * used by the admin "hold as credit" disposition (cancelled paid booking,
 * early-checkout overpayment) and by a cancelled / no-show Pay online
 * booking. Pass the staff client from an admin action, or supabaseAdmin
 * from a guest-initiated flow (anon can't insert guest_credits).
 */
export async function grantGuestCredit(
  client: SupabaseClient,
  args: {
    bookingId: string
    amount: number
    guestEmail: string | null
    guestPhone: string | null
    note: string
    performedBy: string | null
    today: string
  }
): Promise<{ success: true } | { success: false; error: string }> {
  if (!(args.amount > 0)) return { success: true }
  const { error } = await client.from('guest_credits').insert({
    guest_email: args.guestEmail,
    guest_phone: args.guestPhone,
    amount: args.amount,
    source_booking_id: args.bookingId,
    expires_at: creditExpiryFor(args.today),
    note: args.note,
    performed_by: args.performedBy,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}
