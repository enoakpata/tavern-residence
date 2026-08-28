// Plain, dependency-free cancellation-fee rule — no Supabase or other
// server-only imports, so this is safe to import from both server code
// (the actual charging logic in src/lib/bookings.ts) and client
// components (the confirm-modal previews in CancelBookingButton.tsx and
// BookingActions.tsx). Keeping the calculation here as the single source
// of truth is what guarantees those previews can never drift out of sync
// with what the server actually decides.

const FREE_CANCELLATION_HOURS_BEFORE_CHECKIN = 24
const FREE_CANCELLATION_GRACE_PERIOD_HOURS = 1

/**
 * 2:00 PM Lagos time (WAT, UTC+1, no daylight saving) for the given
 * check-in date, expressed as an explicit UTC instant so the 24-hour
 * cutoff below is correct no matter what timezone the code runs in.
 */
function checkInMoment(checkInDate: string): Date {
  return new Date(`${checkInDate}T13:00:00Z`)
}

/**
 * Cancellation is free if EITHER: more than 24 hours before check-in, OR
 * within 1 hour of when the booking was created — a grace period so a
 * same-day booking, which can never be 24 hours from check-in, still gets
 * a short free-cancellation window right after booking. Outside both
 * windows, a flat fee of 50% of one night's rate applies — regardless of
 * how many nights were booked.
 */
export function getCancellationOutcome({
  createdAt,
  checkIn,
  pricePerNight,
}: {
  createdAt: string
  checkIn: string
  pricePerNight: number
}): { free: boolean; feeAmount: number } {
  const hoursUntilCheckIn = (checkInMoment(checkIn).getTime() - Date.now()) / (1000 * 60 * 60)
  const hoursSinceBooked = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60)

  const free =
    hoursUntilCheckIn > FREE_CANCELLATION_HOURS_BEFORE_CHECKIN ||
    hoursSinceBooked <= FREE_CANCELLATION_GRACE_PERIOD_HOURS

  if (free) {
    return { free: true, feeAmount: 0 }
  }

  return { free: false, feeAmount: Math.round(pricePerNight * 0.5) }
}
