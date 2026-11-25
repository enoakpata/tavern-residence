// Plain, dependency-free wording shared by the guest's on-screen
// cancellation message (src/lib/manageBookingMessages.ts, used by a client
// component) and the guest email (src/lib/email.ts), so both say exactly
// the same thing. Deliberately never says "refund".

/** Used when a Pay online booking is cancelled or marked no-show. */
export function creditSavedMessage(amount: number): string {
  return `Your payment of ₦${amount.toLocaleString()} has been saved as credit for a future stay. Contact us to use it.`
}
