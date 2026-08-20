import { createClient } from '@/lib/supabase/server'
import BookingActions from './BookingActions'
import BookingFilters from './BookingFilters'
import { STATUS_STYLES } from '@/lib/statusStyles'

const PAYMENT_STYLES: Record<string, string> = {
  unpaid: 'bg-charcoal/10 text-charcoal/60',
  awaiting_verification: 'bg-brass/20 text-brass',
  paid: 'bg-verdant/15 text-verdant',
  refunded: 'bg-charcoal/10 text-charcoal/60',
}

function nightsBetween(checkIn: string, checkOut: string) {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime()
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)))
}

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

  // The join here relies on the room_id foreign key we set up between
  // Bookings and Rooms — Supabase lets us pull related Room fields in the
  // same query instead of fetching bookings and rooms separately.
  let query = supabase
    .from('Bookings')
    .select('*, Rooms(room_number, name, room_type, price_per_night)')
    .order('check_in', { ascending: true })

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
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-charcoal/10 text-xs tracking-widest text-charcoal/50 uppercase">
                  <th className="px-4 py-3">Guest</th>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Check-in</th>
                  <th className="px-4 py-3">Check-out</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b border-charcoal/5 last:border-0">
                    <td className="px-4 py-3">
                      <p className="text-charcoal">{b.guest_name}</p>
                      <p className="text-xs text-charcoal/50">{b.guest_phone}</p>
                    </td>
                    <td className="px-4 py-3 text-charcoal/80">
                      {b.Rooms
                        ? `${b.Rooms.room_number} · ${b.Rooms.room_type}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-charcoal/80">{b.check_in}</td>
                    <td className="px-4 py-3 text-charcoal/80">{b.check_out}</td>
                    <td className="px-4 py-3 text-charcoal/60 capitalize">
                      {b.source}
                    </td>
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
                    <td className="px-4 py-3">
                      <BookingActions
                        bookingId={b.id}
                        status={b.status}
                        checkIn={b.check_in}
                        guestName={b.guest_name}
                        roomNumber={b.Rooms?.room_number ?? ''}
                        paymentMethod={b.payment_method}
                        paymentStatus={b.payment_status}
                        paymentToken={b.payment_token}
                        totalAmount={
                          b.Rooms
                            ? b.Rooms.price_per_night *
                              nightsBetween(b.check_in, b.check_out)
                            : 0
                        }
                      />
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
