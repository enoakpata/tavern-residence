import { HOTEL_PHONE_DISPLAY, HOTEL_EMAIL } from './siteConfig'

// Every guest-facing message the manage-booking flow (lookup, the
// booking page, cancellation) can show — one place, keyed by a code the
// server actions return instead of raw error text, so this file is the
// only thing that needs editing to change wording, and nothing
// technical (a Postgres message, an internal id, a room number) can
// ever reach the page by accident.
//
// The brief's own wording assumes a "booking reference" field; this
// site looks a booking up by phone + email instead (no reference number
// exists anywhere in the system), so every message below says "phone
// number and email" in its place — same tone, same intent, matching
// what the guest actually typed.
export type ManageBookingErrorCode =
  | 'empty_fields'
  | 'invalid_email'
  | 'not_found'
  | 'link_not_found'
  | 'already_cancelled'
  | 'cancel_locked'
  | 'rate_limited'
  | 'server_error'

export const MANAGE_BOOKING_MESSAGES: Record<ManageBookingErrorCode, string> = {
  empty_fields: 'Please enter your phone number and the email you booked with.',
  invalid_email: "That email doesn't look right. Please check it and try again.",
  // Deliberately identical whether the booking doesn't exist, the
  // phone/email don't match it, or it's checked out (excluded at the
  // query level, same as a wrong reference) — so the message itself
  // never reveals which part was wrong, or that a booking exists at all.
  not_found:
    "We couldn't find a booking with those details. Please check your phone number and email and try again.",
  // Same non-revealing promise as not_found above (doesn't confirm or
  // deny the booking exists), just worded for the direct-link page
  // (/booking/[id], reached from the confirmation email) rather than
  // the phone+email lookup form — "check your phone number and email"
  // wouldn't make sense to someone who arrived via a link, not a form.
  link_not_found:
    "We couldn't find a booking matching this link. Double-check the link from your confirmation email, or look up your booking below.",
  already_cancelled: `This booking has already been cancelled. If you have questions, reach us at ${HOTEL_PHONE_DISPLAY} or ${HOTEL_EMAIL}.`,
  cancel_locked: `This booking can no longer be changed online. Please contact us and we'll be happy to help — ${HOTEL_PHONE_DISPLAY} or ${HOTEL_EMAIL}.`,
  rate_limited: 'Too many attempts. Please wait a few minutes and try again.',
  server_error: 'Something went wrong on our side. Please try again in a moment, or contact us if it keeps happening.',
}

/**
 * The cancel confirmation dialog's own message, shown BEFORE the guest
 * confirms — so they see what (if anything) applies while they can
 * still back out. alreadyPaid overrides the normal time-based policy
 * outcome: once anything has been paid, no cancellation fee applies
 * regardless of timing (matches the admin-side rule for a paid
 * booking), and the guest is told their payment will be handled
 * separately rather than being warned about a fee that won't apply.
 */
export function cancellationPreviewMessage({
  feeMayApply,
  reason,
  alreadyPaid,
}: {
  feeMayApply: boolean
  reason: string
  alreadyPaid: boolean
}): string {
  if (alreadyPaid) {
    return "You've already paid for this stay, so no cancellation fee applies if you cancel now — we'll be in touch about your payment. Continue?"
  }
  if (feeMayApply) {
    return `Per our cancellation policy: ${reason} Our team will follow up about this — continue?`
  }
  return 'Cancel this booking? This is a free cancellation.'
}

/** The success notice after cancelling — same alreadyPaid override as above. */
export function cancellationSuccessMessage({
  feeMayApply,
  feeAmount,
  alreadyPaid,
}: {
  feeMayApply: boolean
  feeAmount: number
  alreadyPaid: boolean
}): string {
  if (alreadyPaid) {
    return "Your booking has been cancelled. Since you've already paid, no cancellation fee applies — we'll be in touch about your payment."
  }
  if (feeMayApply) {
    return `Your booking has been cancelled. A ₦${feeAmount.toLocaleString()} cancellation fee may apply per our policy — we'll be in touch.`
  }
  return 'Your booking has been cancelled — this was a free cancellation.'
}
