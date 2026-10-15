// Plain, dependency-free guest-credit helpers — no Supabase import, so
// the balance math is safe to share between the server actions that
// write guest_credits rows (src/app/admin/bookings/actions.ts) and
// anywhere that just needs to display a balance. Fetching the rows
// themselves is still server-only.

// How long a "hold as credit" grant stays usable before it expires —
// the one place this changes, per the brief's own "default 6 months,
// configurable in one constant".
export const CREDIT_EXPIRY_MONTHS = 6

export type GuestCreditRow = {
  amount: number
  expires_at: string | null
}

/**
 * A guest's current credit balance: the sum of every ledger row, except
 * an expired grant (a positive row whose expires_at has passed) — a
 * spend row (negative amount, from applying credit as a payment) always
 * counts, and a grant with no expiry always counts too (shouldn't occur
 * in practice, since every grant the admin action writes sets one).
 * Floored at 0 — the ledger itself already prevents a spend from
 * exceeding the balance at write time (see spendGuestCredit in
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
