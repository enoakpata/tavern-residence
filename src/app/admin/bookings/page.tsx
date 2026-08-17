import { createClient } from '@/lib/supabase/server'
import BookingActions from './BookingActions'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-brass/20 text-brass',
  confirmed: 'bg-verdant/15 text-verdant',
  checked_in: 'bg-verdant text-ivory',
  checked_out: 'bg-charcoal/10 text-charcoal/60',
  cancelled: 'bg-clay/15 text-clay',
  no_show: 'bg-clay/20 text-clay',
}

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

export default async function BookingsPage() {
  const supabase = await createClient()

  // The join here relies on the room_id foreign key we set up between
  // Bookings and Rooms — Supabase lets us pull related Room fields in the
  // same query instead of fetching bookings and rooms separately.
  const { data: bookings, error } = await supabase
    .from('Bookings')
    .select('*, Rooms(room_number, name, room_type, price_per_night)')
    .order('check_in', { ascending: true })

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
    <main className="mx-auto max-w-6xl px-6 py-12 md:px-12">
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

      {!bookings || bookings.length === 0 ? (
        <p className="mt-12 text-charcoal/60">No bookings yet.</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-sm border border-charcoal/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
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
                      className={`rounded-full px-3 py-1 text-xs capitalize ${STATUS_STYLES[b.status] ?? 'bg-charcoal/10 text-charcoal/60'}`}
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
                      paymentMethod={b.payment_method}
                      paymentStatus={b.payment_status}
                      paymentToken={b.payment_token}
                      guestEmail={b.guest_email}
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
      )}
    </main>
  )
}
