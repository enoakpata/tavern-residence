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

// Shared badge colors for a booking's payment status — used on the
// bookings list table and the booking detail panel.
export const PAYMENT_STYLES: Record<string, string> = {
  unpaid: 'bg-charcoal/10 text-charcoal/60',
  paid: 'bg-verdant/15 text-verdant',
  refunded: 'bg-charcoal/10 text-charcoal/60',
}
