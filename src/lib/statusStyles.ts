// Shared badge colors for a booking's status — used on the bookings list
// table and the calendar's day badges, so both stay visually consistent.
export const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-brass/20 text-brass',
  pending_payment: 'bg-brass/20 text-brass',
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
  pending_payment: 'Awaiting payment',
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
  paid: 'bg-verdant/15 text-verdant',
  refunded: 'bg-charcoal/10 text-charcoal/60',
}
