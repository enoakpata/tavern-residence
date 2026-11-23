// Small date helpers for the calendar — deliberately no external library,
// since the logic needed here (building a month grid, checking overlaps)
// is simple enough not to justify a dependency.

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Parses a 'YYYY-MM-DD' string into a local-time Date at midnight.
 * Deliberately not `new Date(isoString)` — that parses as UTC and can
 * shift the calendar day once converted back to local time.
 */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Today's date in Lagos, Nigeria (WAT, UTC+1, no daylight saving) as
 * 'YYYY-MM-DD' — for anywhere "today" needs to match the hotel's local
 * calendar day regardless of what timezone the server process runs in.
 */
export function todayInLagos(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date())
}

/**
 * The Lagos hour (0–23) at which the hotel night rolls over — the
 * standard check-out time, STANDARD_CHECK_OUT_TIME ('12:00 PM') in
 * src/lib/pricing.ts. Change the two together.
 */
export const HOTEL_DAY_ROLLOVER_HOUR = 12

/**
 * The date of the CURRENT HOTEL NIGHT in Lagos, as 'YYYY-MM-DD'. A night
 * runs 2:00 PM → 12:00 PM next day, so before HOTEL_DAY_ROLLOVER_HOUR the
 * current night is still the one that started yesterday: a guest arriving
 * at 1:00 AM on 24 Nov is staying the night of 23 Nov (check_in 23 Nov,
 * check_out 24 Nov, 1 night). From 12:00 PM onward it's today's date.
 *
 * Use this wherever a STAY date (check-in/check-out) is compared with
 * "today". Keep todayInLagos() for plain calendar-day things — payment
 * dates, promotions admin, credit expiry, departures due today.
 */
export function hotelTodayInLagos(): string {
  const now = new Date()
  const lagosHour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', hourCycle: 'h23' }).format(now)
  )
  const today = todayInLagos()
  if (lagosHour >= HOTEL_DAY_ROLLOVER_HOUR) return today
  // Pure calendar arithmetic on the Lagos date string (UTC so the host's
  // timezone can't shift it).
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Tomorrow's date in Lagos — same rationale as todayInLagos(). WAT has no
 * daylight saving, so a flat 24-hour offset from the current instant
 * always lands on the correct next calendar day once formatted back into
 * Lagos time.
 */
export function tomorrowInLagos(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(
    new Date(Date.now() + 24 * 60 * 60 * 1000)
  )
}

/**
 * A time-of-day in Lagos, Nigeria (WAT, UTC+1, no daylight saving) as a
 * 12-hour clock string like "3:45 PM" — for anywhere a specific
 * cutoff/deadline moment needs to read in the hotel's local time
 * regardless of what timezone the code runs in.
 */
export function formatLagosTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

/**
 * Formats an ISO timestamp explicitly in Africa/Lagos (WAT) time — for
 * any guest/booking timestamp displayed in the admin dashboard, so it
 * reads the same regardless of the viewer's browser timezone or the
 * server's own clock (Vercel runs UTC). A bare toLocaleString() without
 * an explicit timeZone would render in whichever timezone the code
 * happens to run in instead.
 */
export function formatLagosDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'Africa/Lagos',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/**
 * The instant to store for a payment recorded against a chosen calendar
 * date (not necessarily "now"): if that date is today (Lagos), the
 * actual current moment is used; for a past date, midday Africa/Lagos on
 * that date is used instead of midnight, so the stored instant can never
 * display as the wrong calendar day — or an odd early-morning hour like
 * 1:00 AM — once read back in Lagos time. 11:00 UTC = 12:00 (midday) WAT.
 */
export function paymentMomentForDate(dateIso: string): string {
  if (dateIso === todayInLagos()) return new Date().toISOString()
  return new Date(`${dateIso}T11:00:00Z`).toISOString()
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1)
}

export function isBeforeDay(a: Date, b: Date): boolean {
  return toISODate(a) < toISODate(b)
}

export function isSameDay(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b)
}

export function isWithinRange(day: Date, start: Date, end: Date): boolean {
  const iso = toISODate(day)
  return iso >= toISODate(start) && iso <= toISODate(end)
}

/**
 * Builds a 6-row grid of dates for the given month, padded with the
 * trailing days of the previous month and leading days of the next month
 * so every week row is complete (Sunday-start).
 */
export function buildMonthGrid(monthStart: Date): { date: Date; inMonth: boolean }[] {
  const firstWeekday = monthStart.getDay() // 0 = Sunday
  const gridStart = new Date(monthStart)
  gridStart.setDate(gridStart.getDate() - firstWeekday)

  const days: { date: Date; inMonth: boolean }[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    days.push({ date: d, inMonth: d.getMonth() === monthStart.getMonth() })
  }
  return days
}

export type BlockedRange = { checkIn: string; checkOut: string }

/**
 * A date is "blocked" if it falls inside any existing booking's stay —
 * mirrors the same overlap logic used server-side in lib/bookings.ts,
 * just applied to a single day instead of a range.
 */
export function isDateBlocked(day: Date, blockedRanges: BlockedRange[]): boolean {
  const iso = toISODate(day)
  return blockedRanges.some((r) => iso >= r.checkIn && iso < r.checkOut)
}
