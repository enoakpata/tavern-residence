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
// falls inside a promo is priced at the promo rate, every other night at
// the normal rate. A stay that crosses the end of a promo is split — e.g.
// Oct 30 → Nov 2 is two promo nights + one normal night.
//
// Promotions live in the `promotions` table and are managed from the
// admin Promotions page (src/app/admin/promotions) — they switch on and
// off by themselves on their dates; nothing here changes per promo.
// Server code loads them with getPromotions() (src/lib/promotions.ts) and
// passes them in; client components receive them as props. Every
// function below takes the list explicitly, so the server and a client
// preview always price from the exact same promos.

export type PromotionKind = 'fixed' | 'percent'

export type Promotion = {
  id: string
  name: string
  // First and last NIGHT covered, inclusive, as ISO dates. A "night" is
  // identified by the date it starts on (a stay checking in Oct 31 and
  // out Nov 1 is one night: Oct 31).
  firstNight: string
  lastNight: string
  kind: PromotionKind
  // kind 'fixed': nightly price per room type, keyed by the exact
  // Rooms.name (see RoomDbName in roomTypeContent.ts). A type missing
  // from here keeps its normal price.
  rates: Record<string, number> | null
  // kind 'percent': % off every room type's normal price.
  percentOff: number | null
  active: boolean
}

/** Maps a `promotions` row (snake_case, numeric strings) to a Promotion. */
export function rowToPromotion(row: Record<string, unknown>): Promotion {
  const rawRates = (row.rates ?? null) as Record<string, unknown> | null
  const rates: Record<string, number> | null = rawRates
    ? Object.fromEntries(
        Object.entries(rawRates)
          .map(([k, v]) => [k, Number(v)] as const)
          .filter(([, v]) => Number.isFinite(v) && v > 0)
      )
    : null
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    firstNight: String(row.first_night),
    lastNight: String(row.last_night),
    kind: row.kind === 'percent' ? 'percent' : 'fixed',
    rates,
    percentOff: row.percent_off != null ? Number(row.percent_off) : null,
    active: row.active !== false,
  }
}

export type PricedRoom = {
  name?: string | null
  price_per_night: number
}

/** What `promo` charges for one night in `room`, or null if it doesn't cover this room type. */
export function promoRateFor(room: PricedRoom, promo: Promotion): number | null {
  if (promo.kind === 'percent') {
    if (promo.percentOff == null || !(promo.percentOff > 0 && promo.percentOff < 100)) return null
    return Math.round(room.price_per_night * (1 - promo.percentOff / 100))
  }
  if (!room.name || !promo.rates) return null
  const rate = promo.rates[room.name]
  return rate != null && rate > 0 ? rate : null
}

/**
 * The promo (and its rate) applying to one night, or null. If more than
 * one active promo covers the night, the guest gets the LOWEST price.
 */
export function promoForNight(
  room: PricedRoom,
  nightIso: string,
  promos: Promotion[]
): { promo: Promotion; rate: number } | null {
  let best: { promo: Promotion; rate: number } | null = null
  for (const promo of promos) {
    if (!promo.active || nightIso < promo.firstNight || nightIso > promo.lastNight) continue
    const rate = promoRateFor(room, promo)
    if (rate == null) continue
    if (!best || rate < best.rate) best = { promo, rate }
  }
  return best
}

/** The rate for ONE night starting on `nightIso` — promo rate if one applies, otherwise normal. */
export function nightlyRate(room: PricedRoom, nightIso: string, promos: Promotion[]): number {
  return promoForNight(room, nightIso, promos)?.rate ?? room.price_per_night
}

/** The room's normal (non-promo) nightly rate — Rooms.price_per_night. */
export function normalRate(room: PricedRoom): number {
  return room.price_per_night
}

function formatDayMonth(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

/** Guest-facing promo note, e.g. "October promo — ends 31 October". */
export function promoLabel(promo: Promotion): string {
  return `${promo.name} — ends ${formatDayMonth(promo.lastNight)}`
}

/**
 * Promo info for the rate a guest would see for a night starting on
 * `dateIso` — used by the room listings to show a struck-through normal
 * price next to the promo price. Null when no promo applies or it
 * doesn't actually lower the price.
 */
export function promoOnDate(
  room: PricedRoom,
  dateIso: string,
  promos: Promotion[]
): { promoRate: number; normalRate: number; label: string } | null {
  const hit = promoForNight(room, dateIso, promos)
  if (!hit || hit.rate >= room.price_per_night) return null
  return { promoRate: hit.rate, normalRate: room.price_per_night, label: promoLabel(hit.promo) }
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
export function stayTotal(
  room: PricedRoom,
  checkIn: string,
  checkOut: string,
  promos: Promotion[]
): number {
  return stayNights(checkIn, checkOut).reduce((sum, night) => sum + nightlyRate(room, night, promos), 0)
}

/** How many of a stay's nights are at a promo rate — for "includes N promo nights" notes. */
export function promoNightCount(
  room: PricedRoom,
  checkIn: string,
  checkOut: string,
  promos: Promotion[]
): number {
  return stayNights(checkIn, checkOut).filter(
    (night) => nightlyRate(room, night, promos) !== room.price_per_night
  ).length
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

// =====================================================================
// Staff discounts
// =====================================================================

export type DiscountFields = {
  discount_amount?: number | string | null
  discount_percent?: number | string | null
}

/**
 * The naira discount on a booking. A percentage discount is recomputed
 * from the room total (so 10% stays 10% when dates or the room change);
 * a fixed discount is used as stored. Never more than the room total.
 * Applies to the room total only — not to early check-in / late
 * check-out fees.
 */
export function discountFor(booking: DiscountFields, roomTotal: number): number {
  const percent = booking.discount_percent != null ? Number(booking.discount_percent) : null
  const raw =
    percent != null && percent > 0
      ? Math.round((roomTotal * percent) / 100)
      : Number(booking.discount_amount ?? 0)
  return Math.min(Math.max(0, raw), Math.max(0, roomTotal))
}

/**
 * A booking's full total from its parts: room total (promo-aware) + early
 * check-in / late check-out fees − discount. Every place that stores or
 * previews a total goes through this.
 */
export function bookingTotal(
  roomTotal: number,
  booking: ExtraFees & DiscountFields
): { roomTotal: number; fees: number; discount: number; total: number } {
  const fees = extraFeesTotal(booking)
  const discount = discountFor(booking, roomTotal)
  return { roomTotal, fees, discount, total: roomTotal + fees - discount }
}
