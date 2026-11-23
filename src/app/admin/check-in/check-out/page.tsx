import { createClient } from '@/lib/supabase/server'
import { bookingsQuery } from '@/lib/adminBookings'
import { todayInLagos, hotelTodayInLagos } from '@/lib/dateUtils'
import CheckInButton from './CheckInButton'
import CheckOutButton from './CheckOutButton'
import { ActionResultProvider } from './ActionResultContext'

export default async function TodayPage() {
  const supabase = await createClient()

  // Guests expected to arrive today who haven't been checked in yet —
  // always shows the same thing regardless of any filters elsewhere in
  // the admin section. Shares bookingsQuery() with the "All Bookings"
  // table (src/lib/adminBookings.ts) so the two views can never quietly
  // drift into disagreeing about what a booking looks like.
  //
  // Between midnight and 12:00 PM Lagos the current hotel night is still
  // yesterday's, so arrivals also include not-yet-checked-in bookings for
  // that night (e.g. a 1 AM walk-in booked check_in = yesterday). From
  // 12:00 PM both dates are the same, so it's just today's arrivals.
  const today = todayInLagos()
  const arrivalDates = Array.from(new Set([hotelTodayInLagos(), today]))
  const { data: todaysCheckIns } = await bookingsQuery(supabase)
    .in('check_in', arrivalDates)
    .eq('status', 'confirmed')
    .order('guest_name', { ascending: true })

  // Guests currently staying who are expected to leave today (by 12:00 PM)
  // — stays on the plain calendar day. The auto-checkout cron (see
  // src/app/api/cron/auto-checkout) marks anyone still checked in as
  // checked out at 12:00 PM Lagos; this is the manual path for staff.
  const { data: todaysCheckOuts } = await bookingsQuery(supabase)
    .eq('check_out', today)
    .eq('status', 'checked_in')
    .order('guest_name', { ascending: true })

  return (
    <ActionResultProvider>
    <main className="mx-auto max-w-6xl px-6 pt-6 pb-12 md:px-12">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs tracking-widest text-brass uppercase">
            Front desk
          </p>
          <h1 className="mt-2 font-display text-3xl text-charcoal">
            Today
          </h1>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-xl text-charcoal">
          Today&apos;s Check-ins
        </h2>

        {!todaysCheckIns || todaysCheckIns.length === 0 ? (
          <p className="mt-4 text-sm text-charcoal/60">
            No check-ins expected today.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {todaysCheckIns.map((b) => (
              <div
                key={b.id}
                className="rounded-sm border border-charcoal/10 bg-white p-5"
              >
                <p className="text-xs tracking-widest text-brass uppercase">
                  {b.Rooms ? `Room ${b.Rooms.room_number}` : 'Room'}
                </p>
                <p className="mt-1 font-display text-lg text-charcoal">
                  {b.guest_name}
                </p>
                <p className="text-sm text-charcoal/60">{b.guest_phone}</p>
                <CheckInButton bookingId={b.id} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl text-charcoal">
          Today&apos;s Checkouts
        </h2>

        {!todaysCheckOuts || todaysCheckOuts.length === 0 ? (
          <p className="mt-4 text-sm text-charcoal/60">
            No checkouts expected today.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {todaysCheckOuts.map((b) => (
              <div
                key={b.id}
                className="rounded-sm border border-charcoal/10 bg-white p-5"
              >
                <p className="text-xs tracking-widest text-brass uppercase">
                  {b.Rooms ? `Room ${b.Rooms.room_number}` : 'Room'}
                </p>
                <p className="mt-1 font-display text-lg text-charcoal">
                  {b.guest_name}
                </p>
                <p className="text-sm text-charcoal/60">{b.guest_phone}</p>
                <CheckOutButton
                  bookingId={b.id}
                  guestName={b.guest_name}
                  roomNumber={b.Rooms?.room_number ?? ''}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
    </ActionResultProvider>
  )
}
