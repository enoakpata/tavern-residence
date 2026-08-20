import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { addMonths, parseISODate, startOfMonth, toISODate } from '@/lib/dateUtils'
import CalendarGrid, { type DayBookingEntry } from './CalendarGrid'

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const monthParam = Number(params.month)
  const yearParam = Number(params.year)
  const visibleMonth =
    Number.isInteger(monthParam) &&
    monthParam >= 1 &&
    monthParam <= 12 &&
    Number.isInteger(yearParam) &&
    yearParam > 0
      ? new Date(yearParam, monthParam - 1, 1)
      : startOfMonth(new Date())

  const monthEnd = addMonths(visibleMonth, 1)

  const supabase = await createClient()

  // Same overlap idiom as isRoomAvailable in lib/bookings.ts, so a booking
  // that starts before the visible month and ends inside it (or vice
  // versa) is still picked up. Every status is included (not just active
  // ones) so staff see the complete picture for a date, color-coded by
  // status in the grid.
  const { data: bookings, error } = await supabase
    .from('Bookings')
    .select('*, Rooms(room_number)')
    .lt('check_in', toISODate(monthEnd))
    .gt('check_out', toISODate(visibleMonth))

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12 md:px-12">
        <p className="text-clay">
          Couldn&apos;t load the calendar: {error.message}
        </p>
        <p className="mt-2 text-sm text-charcoal/60">
          If this says permission denied, the Bookings table likely needs an
          RLS policy allowing authenticated staff to read it.
        </p>
      </main>
    )
  }

  // Expand each booking's stay into a per-day badge, clipped to the days
  // that actually fall within the visible month.
  const bookingsByDate: Record<string, DayBookingEntry[]> = {}
  for (const booking of bookings ?? []) {
    const entry: DayBookingEntry = {
      roomNumber: booking.Rooms?.room_number ?? '—',
      guestName: booking.guest_name,
      guestPhone: booking.guest_phone,
      paymentMethod: booking.payment_method,
      source: booking.source,
      status: booking.status,
    }

    const bookingStart = parseISODate(booking.check_in)
    const bookingEnd = parseISODate(booking.check_out)
    const rangeStart = bookingStart > visibleMonth ? bookingStart : visibleMonth
    const rangeEnd = bookingEnd < monthEnd ? bookingEnd : monthEnd

    const cursor = new Date(rangeStart)
    while (cursor < rangeEnd) {
      const iso = toISODate(cursor)
      ;(bookingsByDate[iso] ??= []).push(entry)
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  const monthLabel = visibleMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
  const prevMonth = addMonths(visibleMonth, -1)
  const nextMonth = addMonths(visibleMonth, 1)

  return (
    <main className="mx-auto max-w-6xl px-6 pt-6 pb-12 md:px-12">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs tracking-widest text-brass uppercase">
            Front desk
          </p>
          <h1 className="mt-2 font-display text-3xl text-charcoal">
            Calendar
          </h1>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-center gap-6">
        <Link
          href={`/admin/calendar?month=${prevMonth.getMonth() + 1}&year=${prevMonth.getFullYear()}`}
          className="rounded-full p-2 text-charcoal/50 transition-colors hover:bg-verdant/10 hover:text-verdant"
          aria-label="Previous month"
        >
          ←
        </Link>
        <p className="w-40 text-center font-display text-xl text-charcoal">
          {monthLabel}
        </p>
        <Link
          href={`/admin/calendar?month=${nextMonth.getMonth() + 1}&year=${nextMonth.getFullYear()}`}
          className="rounded-full p-2 text-charcoal/50 transition-colors hover:bg-verdant/10 hover:text-verdant"
          aria-label="Next month"
        >
          →
        </Link>
      </div>

      <CalendarGrid
        visibleMonth={toISODate(visibleMonth)}
        bookingsByDate={bookingsByDate}
      />
    </main>
  )
}
