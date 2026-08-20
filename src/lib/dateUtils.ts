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
