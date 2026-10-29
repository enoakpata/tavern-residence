// Plain, dependency-free room pricing — no Supabase or other server-only
// imports, so it's safe to share between the server actions that store a
// booking's total (createBooking, createManualBooking, editBookingDates,
// changeBookingRoom, earlyCheckout) and the client components that
// preview one (BookingForm.tsx, NewBookingForm.tsx, BookingActions.tsx).
// Keeping the rule here is what guarantees a guest is never shown one
// total and then charged a different one.
//
// Rooms.price_per_night stays the hotel's NORMAL rate. A promotion is a
// dated override on top of it, applied night by night: each night that
// falls inside the promo window is priced at the promo rate, every other
// night at the normal rate. A stay that crosses the end of a promo is
// split — e.g. Oct 30 → Nov 2 is two promo nights + one normal night.
// Nothing needs changing in Supabase when a promo starts or ends; once
// the end date passes, every price shown and charged reverts on its own.

export type Promo = {
  // First and last NIGHT covered, inclusive, as ISO dates. A "night" is
  // identified by the date it starts on (a stay checking in Oct 31 and
  // out Nov 1 is one night: Oct 31).
  firstNight: string
  lastNight: string
  // Promo nightly rate per room type, keyed by the exact Rooms.name value
  // (see RoomDbName in roomTypeContent.ts). A type missing from here just
  // keeps its normal rate during the promo.
  rates: Partial<Record<string, number>>
  // Short guest-facing description, e.g. for a "promo" note next to a price.
  label: string
}

// October 2026 promo. To run a future promo, replace this (or add to
// PROMOS) — nothing else needs changing.
export const PROMOS: Promo[] = [
  {
    firstNight: '2026-10-01',
    lastNight: '2026-10-31',
    rates: {
      'Single Room': 90000,
      'Studio Room': 100000,
      '1-Bedroom Deluxe': 150000,
      '1-Bedroom Suite': 180000,
    },
    label: 'October promo — ends 31 October',
  },
]

export type PricedRoom = {
  name?: string | null
  price_per_night: number
}

function activePromoFor(room: PricedRoom, nightIso: string): Promo | null {
  if (!room.name) return null
  return (
    PROMOS.find(
      (p) => nightIso >= p.firstNight && nightIso <= p.lastNight && p.rates[room.name!] != null
    ) ?? null
  )
}

/** The rate for ONE night starting on `nightIso` — promo rate if one applies, otherwise normal. */
export function nightlyRate(room: PricedRoom, nightIso: string): number {
  const promo = activePromoFor(room, nightIso)
  return promo ? (promo.rates[room.name!] as number) : room.price_per_night
}

/** The room's normal (non-promo) nightly rate — Rooms.price_per_night. */
export function normalRate(room: PricedRoom): number {
  return room.price_per_night
}

/**
 * Promo info for the rate a guest would see if their stay started on
 * `todayIso` — used by the room listings to show a struck-through normal
 * price next to the promo price. Null when no promo applies.
 */
export function promoOnDate(
  room: PricedRoom,
  todayIso: string
): { promoRate: number; normalRate: number; label: string } | null {
  const promo = activePromoFor(room, todayIso)
  if (!promo) return null
  const promoRate = promo.rates[room.name!] as number
  if (promoRate === room.price_per_night) return null
  return { promoRate, normalRate: room.price_per_night, label: promo.label }
}

// ISO date arithmetic in UTC, so the result never depends on the timezone
// the code happens to run in (server or browser).
function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Each night of a stay, by the date it starts on — [checkIn, checkOut). */
export function stayNights(checkIn: string, checkOut: string): string[] {
  const nights: string[] = []
  for (let night = checkIn; night < checkOut; night = addDaysIso(night, 1)) {
    nights.push(night)
    if (nights.length > 3660) break // guard against a malformed date looping forever
  }
  // Matches the old nightsBetween()'s Math.max(1, …): a degenerate range
  // still counts as one night at the check-in date's rate.
  return nights.length > 0 ? nights : [checkIn]
}

/**
 * The stay's room total, summing each night's own rate — replaces the old
 * `price_per_night × nights`, which couldn't express a promo that ends
 * part-way through a stay.
 */
export function stayTotal(room: PricedRoom, checkIn: string, checkOut: string): number {
  return stayNights(checkIn, checkOut).reduce((sum, night) => sum + nightlyRate(room, night), 0)
}

/** How many of a stay's nights are at a promo rate — for "includes N promo nights" notes. */
export function promoNightCount(room: PricedRoom, checkIn: string, checkOut: string): number {
  return stayNights(checkIn, checkOut).filter((night) => nightlyRate(room, night) !== room.price_per_night)
    .length
}

// =====================================================================
// Early check-in / late check-out
// =====================================================================

// Flat fee for each, in naira — the same for every room type, promo or
// not. The one place to change it.
export const EARLY_LATE_FEE = 50000

// Guest-facing times, used in the policy copy and emails.
export const STANDARD_CHECK_IN_TIME = '2:00 PM'
export const STANDARD_CHECK_OUT_TIME = '12:00 PM'
export const LATE_CHECK_OUT_LATEST_TIME = '4:00 PM'

// Exact guest-facing wording, used verbatim on the Policies page and in
// the booking confirmation email so the two can't drift apart.
export const EARLY_LATE_POLICY_TEXT =
  `Early check-in (any time before ${STANDARD_CHECK_IN_TIME}) and late check-out (until ${LATE_CHECK_OUT_LATEST_TIME}) are available on request, subject to availability. Each costs ₦${EARLY_LATE_FEE.toLocaleString('en-NG')}.`

// Takes the room so a per-room fee could be introduced later without
// touching any caller; today it's the same flat amount for every room.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function earlyLateFee(_room?: PricedRoom | null): number {
  return EARLY_LATE_FEE
}

export type ExtraFees = {
  early_checkin_fee?: number | string | null
  late_checkout_fee?: number | string | null
}

/** Sum of a booking's early check-in / late check-out fees (0 if neither). */
export function extraFeesTotal(booking: ExtraFees): number {
  return Number(booking.early_checkin_fee ?? 0) + Number(booking.late_checkout_fee ?? 0)
}
