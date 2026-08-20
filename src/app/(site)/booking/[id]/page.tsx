import type { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import CancelBookingButton from './CancelBookingButton'

// Unindexed — possession of the unguessable booking ID is the only
// "authorization" this page checks, so it shouldn't be crawlable.
export const metadata: Metadata = {
  title: 'Manage Your Booking | Tavern Residence',
  robots: { index: false, follow: false },
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending confirmation',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  cancelled: 'Cancelled',
  no_show: 'No-show',
}

const NON_CANCELLABLE_STATUSES = ['cancelled', 'checked_out', 'no_show']

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime()
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)))
}

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data: booking } = await supabaseAdmin
    .from('Bookings')
    .select('*, Rooms(name, room_number, price_per_night)')
    .eq('id', id)
    .single()

  if (!booking) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center md:px-12">
        <p className="text-xs tracking-widest text-brass uppercase">
          Manage booking
        </p>
        <h1 className="mt-3 font-display text-3xl text-charcoal">
          Booking not found
        </h1>
        <p className="mt-4 text-charcoal/70">
          We couldn&apos;t find a booking matching this link. Double-check the
          link from your confirmation email, or reach us at 0701 583 2637 if
          you need help.
        </p>
      </main>
    )
  }

  const room = booking.Rooms
  const totalAmount = room
    ? room.price_per_night * nightsBetween(booking.check_in, booking.check_out)
    : 0
  const canCancel = !NON_CANCELLABLE_STATUSES.includes(booking.status)

  return (
    <main className="mx-auto max-w-xl px-6 py-16 md:px-12 md:py-24">
      <p className="text-xs tracking-widest text-brass uppercase">
        Manage booking
      </p>
      <h1 className="mt-3 font-display text-3xl text-charcoal md:text-4xl">
        {booking.guest_name}&apos;s stay
      </h1>

      <div className="mt-8 rounded-sm border border-charcoal/10 bg-white p-6">
        <p className="text-xs tracking-widest text-brass uppercase">
          {room ? `${room.room_number} — ${room.name}` : 'Room'}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-charcoal/10 pt-4 text-sm">
          <div>
            <dt className="text-charcoal/50">Check-in</dt>
            <dd className="mt-1 text-charcoal">{formatDate(booking.check_in)}</dd>
          </div>
          <div>
            <dt className="text-charcoal/50">Check-out</dt>
            <dd className="mt-1 text-charcoal">{formatDate(booking.check_out)}</dd>
          </div>
          <div>
            <dt className="text-charcoal/50">Status</dt>
            <dd className="mt-1 text-charcoal">
              {STATUS_LABELS[booking.status] ?? booking.status}
            </dd>
          </div>
          {room && (
            <div>
              <dt className="text-charcoal/50">Total</dt>
              <dd className="mt-1 text-charcoal">₦{totalAmount.toLocaleString()}</dd>
            </div>
          )}
        </dl>
      </div>

      {canCancel ? (
        <div className="mt-8">
          <CancelBookingButton
            bookingId={booking.id}
            checkIn={booking.check_in}
            totalAmount={totalAmount}
          />
        </div>
      ) : (
        <p className="mt-8 text-sm text-charcoal/60">
          This booking is {(STATUS_LABELS[booking.status] ?? booking.status).toLowerCase()} —
          there&apos;s nothing to cancel.
        </p>
      )}
    </main>
  )
}
