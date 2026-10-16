// Plain, dependency-free cancellation-fee rule — no Supabase or other
// server-only imports, so this is safe to import from both server code
// (the actual charging logic in src/app/admin/bookings/actions.ts and
// src/app/(site)/booking/[id]/actions.ts) and client components (the
// confirm-modal previews in CancelBookingButton.tsx, BookingActions.tsx,
// and the admin PaymentsSection.tsx's charge dialog). Keeping the
// calculation here as the single source of truth is what guarantees
// those previews can never drift out of sync with what the server
// actually decides, or with each other.

import { CANCELLATION_FEE_FRACTION } from './siteConfig'

const FREE_CANCELLATION_HOURS_BEFORE_CHECKIN = 24
const FREE_CANCELLATION_GRACE_PERIOD_HOURS = 1

// 2:00 PM Africa/Lagos time (WAT, UTC+1, no daylight saving) — the
// configured default check-in time, matching what's published on
// /policies ("Check-in: from 2:00 PM") and in BookingForm.tsx's own
// copy. Bookings has no per-booking check-in time column, so every
// booking uses this same default.
const CHECK_IN_HOUR_UTC = 13 // 13:00 UTC = 14:00 (2:00 PM) WAT

/**
 * The given check-in date's 2:00 PM Lagos moment, expressed as an
 * explicit UTC instant so the 24-hour cutoff below is correct no matter
 * what timezone the code runs in.
 */
function checkInMoment(checkInDate: string): Date {
  return new Date(`${checkInDate}T${String(CHECK_IN_HOUR_UTC).padStart(2, '0')}:00:00Z`)
}

export type CancellationOutcome = {
  feeApplies: boolean
  feeAmount: number
  reason: string
}

/**
 * Cancellation/no-show fee rule:
 *  - Free if more than 24 hours before check-in.
 *  - Free if within 1 hour of the booking's created_at — a grace period
 *    so a same-day booking (which can never be 24 hours from check-in)
 *    still gets a short free-cancellation window right after booking.
 *  - Otherwise (including a check-in time that's already passed, i.e. a
 *    no-show) a flat fee of CANCELLATION_FEE_FRACTION (50%) of ONE
 *    NIGHT'S rate applies — regardless of how many nights were booked,
 *    rounded to the nearest naira.
 */
export function getCancellationOutcome({
  createdAt,
  checkIn,
  pricePerNight,
}: {
  createdAt: string
  checkIn: string
  pricePerNight: number
}): CancellationOutcome {
  const now = Date.now()
  const hoursUntilCheckIn = (checkInMoment(checkIn).getTime() - now) / (1000 * 60 * 60)
  const hoursSinceBooked = (now - new Date(createdAt).getTime()) / (1000 * 60 * 60)

  if (hoursUntilCheckIn > FREE_CANCELLATION_HOURS_BEFORE_CHECKIN) {
    return {
      feeApplies: false,
      feeAmount: 0,
      reason: 'Free cancellation — more than 24 hours before check-in.',
    }
  }

  if (hoursSinceBooked <= FREE_CANCELLATION_GRACE_PERIOD_HOURS) {
    return {
      feeApplies: false,
      feeAmount: 0,
      reason: 'Free cancellation — within 1 hour of booking (same-day grace period).',
    }
  }

  const feeAmount = Math.round(pricePerNight * CANCELLATION_FEE_FRACTION)
  const percent = CANCELLATION_FEE_FRACTION * 100
  const timing =
    hoursUntilCheckIn < 0
      ? 'no-show — check-in time has passed'
      : `cancelled ${Math.round(hoursUntilCheckIn)} hour${Math.round(hoursUntilCheckIn) === 1 ? '' : 's'} before check-in`

  return {
    feeApplies: true,
    feeAmount,
    reason: `${percent}% of one night's rate (₦${pricePerNight.toLocaleString()}), ${timing}.`,
  }
}

// Exact wording, used verbatim everywhere the cancellation policy is
// shown to a guest: the booking form's policy summary/full-policy
// expansion, the manage-booking cancellation flow, guest confirmation/
// cancellation emails, and the Policies page. One array so none of those
// can drift out of sync.
export const CANCELLATION_POLICY_BULLETS = [
  'Free cancellation up to 24 hours before check-in.',
  "Late cancellation or no-show: if you cancel less than 24 hours before check-in, or do not arrive, a charge of 50% of one night's rate applies.",
  'Same-day bookings: you may cancel free of charge within 1 hour of making the booking. After that, cancellation or no-show incurs the 50% charge.',
  'A valid card is required to hold your booking. It is used only to collect cancellation or no-show charges under this policy. Your stay is paid directly to the hotel.',
]

// The required card-hold consent checkbox wording (BookingForm.tsx) —
// stored verbatim.
export const CARD_HOLD_CONSENT_TEXT =
  "I agree to the cancellation policy and authorise Tavern Residence to charge my card 50% of one night's rate if I cancel late or don't arrive."
