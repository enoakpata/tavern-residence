// Plain, dependency-free booking/payment status rules — no Supabase or
// other server-only imports, so this is safe to import from both server
// code (the actual mutations in src/app/admin/bookings/actions.ts) and
// client components (BookingDetailModal.tsx, PaymentsSection.tsx,
// BookingActions.tsx). Keeping these here as the single source of truth
// is what guarantees the admin UI and the server actions it calls can
// never disagree about whether a booking is paid or locked.

/**
 * The one status value that makes a booking fully read-only everywhere
 * in the admin dashboard — see isBookingLocked below. Other terminal
 * statuses exist (checked_out, no_show) but are NOT locked by this: a
 * checked_out booking can still have a late payment recorded against it,
 * for instance. Only an explicit ask would extend this set.
 */
export const LOCKED_BOOKING_STATUS = 'cancelled'

export function isBookingLocked(booking: { status: string }): boolean {
  return booking.status === LOCKED_BOOKING_STATUS
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime()
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)))
}

/**
 * A booking's total stay amount — the stored total_amount when present,
 * falling back to nights × price_per_night only for a booking made
 * before that column existed. Used everywhere a total is needed for
 * display or status computation, so the two can never read differently
 * for the same booking (the bug this fixes: the Payments section was
 * displaying this fallback-resolved total, while the server computed
 * payment_status from the raw, sometimes-null column instead).
 */
export function resolveTotalAmount(
  booking: { total_amount: number | null; check_in: string; check_out: string },
  room: { price_per_night: number } | null | undefined
): number {
  if (booking.total_amount != null) return booking.total_amount
  return (room?.price_per_night ?? 0) * nightsBetween(booking.check_in, booking.check_out)
}

export type PaymentStatus = 'unpaid' | 'partial' | 'paid'

/**
 * Derives payment_status from the ledger total rather than trusting a
 * caller to set it by hand — amountPaid should already be the sum of
 * every successful, non-voided booking_payments row (a void is its own
 * negative-amount row, so summing naturally nets it out). totalAmount
 * should already be resolved via resolveTotalAmount above, not the raw
 * nullable column.
 */
export function computePaymentStatus(amountPaid: number, totalAmount: number): PaymentStatus {
  if (amountPaid <= 0) return 'unpaid'
  if (amountPaid >= totalAmount) return 'paid'
  return 'partial'
}

/**
 * How much over the total a booking has been paid, or null if it hasn't
 * been overpaid — the UI shows this as an extra flag alongside the
 * "Paid" badge, not a different payment_status value.
 */
export function overpaidAmount(amountPaid: number, totalAmount: number): number | null {
  const over = amountPaid - totalAmount
  return over > 0 ? over : null
}
