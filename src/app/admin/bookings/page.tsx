import { createClient } from '@/lib/supabase/server'
import { bookingsQuery } from '@/lib/adminBookings'
import ViewBookingButton from './ViewBookingButton'
import BookingFilters from './BookingFilters'
import { STATUS_STYLES, PAYMENT_STYLES } from '@/lib/statusStyles'

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const search = typeof params.search === 'string' ? params.search.trim() : ''
  const month = typeof params.month === 'string' ? params.month : ''
  const year = typeof params.year === 'string' ? params.year : ''
  const source = typeof params.source === 'string' ? params.source : ''
  const hasActiveFilters = Boolean(search || month || year || source)

  const supabase = await createClient()

  // The year dropdown reflects every year that appears anywhere in the
  // data, not just what the current filters return, so switching years
  // stays possible after narrowing by search/month/source.
  const { data: checkInRows } = await supabase.from('Bookings').select('check_in')
  const distinctYears = Array.from(
    new Set((checkInRows ?? []).map((row) => Number(row.check_in.slice(0, 4))))
  ).sort((a, b) => b - a)
  const currentYear = new Date().getFullYear()
  const years =
    distinctYears.length > 0
      ? distinctYears
      : [currentYear + 1, currentYear, currentYear - 1]

  // Shared with Today's Check-ins/Check-outs (src/lib/adminBookings.ts) so
  // this table and that page can never quietly drift into showing a
  // different shape — or set — of bookings from each other.
  let query = bookingsQuery(supabase).order('check_in', { ascending: true })

  if (search) {
    // Commas/parens are structural in PostgREST's .or() filter syntax, so
    // strip them from user input rather than let them alter the query.
    const safeSearch = search.replace(/[,()]/g, '')
    query = query.or(
      `guest_name.ilike.%${safeSearch}%,guest_phone.ilike.%${safeSearch}%`
    )
  }
  if (source) {
    query = query.eq('source', source)
  }
  if (year) {
    const yearNum = Number(year)
    query = query
      .gte('check_in', `${yearNum}-01-01`)
      .lt('check_in', `${yearNum + 1}-01-01`)
  }

  const { data: bookingsData, error } = await query

  // Month has no year attached (it should match any year), and PostgREST
  // has no clean way to filter on just the month part of a date column, so
  // it's applied in memory against the already-narrowed result set.
  const bookings = month
    ? (bookingsData ?? []).filter((b) => b.check_in.slice(5, 7) === month)
    : (bookingsData ?? [])

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12 md:px-12">
        <p className="text-clay">
          Couldn&apos;t load bookings: {error.message}
        </p>
        <p className="mt-2 text-sm text-charcoal/60">
          If this says permission denied, the Bookings table likely needs an
          RLS policy allowing authenticated staff to read it.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-6 pt-6 pb-12 md:px-12">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs tracking-widest text-brass uppercase">
            Front desk
          </p>
          <h1 className="mt-2 font-display text-3xl text-charcoal">
            Bookings
          </h1>
        </div>
      </div>

      <BookingFilters years={years} />

      {!bookings || bookings.length === 0 ? (
        <p className="mt-12 text-charcoal/60">
          {hasActiveFilters
            ? 'No bookings match your filters.'
            : 'No bookings yet.'}
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs text-charcoal/50 sm:hidden">
            Scroll horizontally to see more →
          </p>
          <div className="mt-2 max-h-[600px] overflow-auto rounded-sm border border-charcoal/10 bg-white sm:mt-8">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-charcoal/10 text-xs tracking-widest text-charcoal/50 uppercase">
                  <th className="px-4 py-3">Guest</th>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Check-in</th>
                  <th className="px-4 py-3">Check-out</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b border-charcoal/5 last:border-0">
                    <td className="px-4 py-3 text-charcoal">{b.guest_name}</td>
                    <td className="px-4 py-3 text-charcoal/80">
                      {b.Rooms
                        ? `${b.Rooms.room_number} · ${b.Rooms.room_type}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-charcoal/80">{b.check_in}</td>
                    <td className="px-4 py-3 text-charcoal/80">{b.check_out}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`whitespace-nowrap rounded-full px-3 py-1 text-xs capitalize ${STATUS_STYLES[b.status] ?? 'bg-charcoal/10 text-charcoal/60'}`}
                      >
                        {b.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs capitalize ${PAYMENT_STYLES[b.payment_status] ?? 'bg-charcoal/10 text-charcoal/60'}`}
                      >
                        {b.payment_status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ViewBookingButton bookingId={b.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  )
}
