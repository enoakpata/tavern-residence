// Shared badge colors for a booking's status — used on the bookings list
// table and the calendar's day badges, so both stay visually consistent.
export const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-brass/20 text-brass',
  confirmed: 'bg-verdant/15 text-verdant',
  checked_in: 'bg-verdant text-ivory',
  checked_out: 'bg-charcoal/10 text-charcoal/60',
  cancelled: 'bg-clay/15 text-clay',
  no_show: 'bg-clay/20 text-clay',
}

// Shared human-readable labels for a booking's status — used wherever the
// raw status needs friendlier text than a plain `.replace('_', ' ')` would
// give (e.g. "pending" reading as "Pending confirmation"). Kept in one
// place so the guest-facing manage-booking pages and the admin detail
// panel can never show different wording for the same status.
export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending confirmation',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  cancelled: 'Cancelled',
  no_show: 'No-show',
}

// Shared badge colors for a booking's payment status — used on the
// bookings list table and the booking detail panel.
export const PAYMENT_STYLES: Record<string, string> = {
  unpaid: 'bg-charcoal/10 text-charcoal/60',
  partial: 'bg-brass/20 text-brass',
  paid: 'bg-verdant/15 text-verdant',
  refunded: 'bg-charcoal/10 text-charcoal/60',
}

// Small badge for Pay online bookings — shown on the bookings list and the
// booking detail panel. A pending Pay online booking is a room hold while
// the guest is still in the Paystack popup (deleted after 30 minutes if
// never paid — see src/lib/onlinePayments.ts).
export const PAID_ONLINE_BADGE_STYLE = 'bg-espresso/10 text-espresso'

export function onlinePaymentBadgeLabel(booking: {
  payment_option?: string | null
  status: string
}): string | null {
  if (booking.payment_option !== 'pay_online') return null
  return booking.status === 'pending' ? 'Awaiting online payment' : 'Paid online'
}

export const PAYMENT_OPTION_LABELS: Record<string, string> = {
  pay_online: 'Pay online',
  pay_in_person: 'Pay in person',
}
