import { createClient } from '@/lib/supabase/server'
import { bookingsQuery } from '@/lib/adminBookings'
import { todayInLagos } from '@/lib/dateUtils'
import CheckInButton from './CheckInButton'
import CheckOutButton from './CheckOutButton'
import { CheckInResultProvider } from './CheckInResultContext'

function nightsBetween(checkIn: string, checkOut: string) {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime()
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)))
}

export default async function TodayPage() {
  const supabase = await createClient()

  // Guests expected to arrive today who haven't been checked in yet —
  // always shows the same thing regardless of any filters elsewhere in
  // the admin section. Shares bookingsQuery() with the "All Bookings"
  // table (src/lib/adminBookings.ts) so the two views can never quietly
  // drift into disagreeing about what a booking looks like.
  const today = todayInLagos()
  const { data: todaysCheckIns } = await bookingsQuery(supabase)
    .eq('check_in', today)
    .eq('status', 'confirmed')
    .order('guest_name', { ascending: true })

  // Guests currently staying who are expected to leave today — the daily
  // auto-checkout cron job (see src/app/api/cron/auto-checkout) still
  // handles anything left un-checked-out by end of day; this is just the
  // manual same-day path for staff.
  const { data: todaysCheckOuts } = await bookingsQuery(supabase)
    .eq('check_out', today)
    .eq('status', 'checked_in')
    .order('guest_name', { ascending: true })

  return (
    <CheckInResultProvider>
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
                <CheckInButton
                  bookingId={b.id}
                  paymentStatus={b.payment_status}
                  paymentToken={b.payment_token}
                  guestEmail={b.guest_email}
                  totalAmount={
                    b.Rooms
                      ? b.Rooms.price_per_night * nightsBetween(b.check_in, b.check_out)
                      : 0
                  }
                />
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
    </CheckInResultProvider>
  )
}
