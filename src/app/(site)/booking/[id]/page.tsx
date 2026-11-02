import type { Metadata } from 'next'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getChargeableAuthCode } from '@/lib/bookings'
import { resolveTotalAmount } from '@/lib/bookingStatus'
import { CANCELLATION_POLICY_BULLETS } from '@/lib/cancellationPolicy'
import { HOTEL_NAME } from '@/lib/siteConfig'
import { STATUS_LABELS } from '@/lib/statusStyles'
import { displayRoomName } from '@/lib/roomTypeContent'
import { MANAGE_BOOKING_MESSAGES } from '@/lib/manageBookingMessages'
import CancelBookingButton from './CancelBookingButton'

// Unindexed — possession of the unguessable booking ID is the only
// "authorization" this page checks, so it shouldn't be crawlable.
export const metadata: Metadata = {
  title: `Manage Your Booking | ${HOTEL_NAME}`,
  robots: { index: false, follow: false },
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

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // A checked-out booking is excluded at the query level — same as the
  // search list in manage-booking/actions.ts — so it falls into the
  // !booking branch below and gets the identical generic "not found"
  // message a bad/unknown ID would, with nothing that leaks it exists.
  // Cancelled bookings aren't excluded here; they still load and show
  // their own "This booking is cancelled" read-only state further down.
  const { data: booking } = await supabaseAdmin
    .from('Bookings')
    .select('*, Rooms(name, price_per_night)')
    .eq('id', id)
    .neq('status', 'checked_out')
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
        <p role="alert" className="mt-4 text-charcoal/70">
          {MANAGE_BOOKING_MESSAGES.link_not_found}
        </p>
        <Link
          href="/manage-booking"
          className="mt-6 inline-block text-sm text-espresso underline underline-offset-4"
        >
          Look up your booking
        </Link>
      </main>
    )
  }

  const room = booking.Rooms
  // Prefer the stored total_amount (authoritative for any booking made
  // after the card-hold migration) — the same shared resolution the
  // admin dashboard uses, so guest and staff never see different totals.
  const totalAmount = resolveTotalAmount(booking, room)
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
          {displayRoomName(room?.name, 'Room')}
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

      {canCancel && (
        <div className="mt-8 rounded-sm bg-charcoal/5 p-5 text-xs text-charcoal/60">
          <p className="text-xs tracking-widest text-charcoal/50 uppercase">Cancellation policy</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-4">
            {CANCELLATION_POLICY_BULLETS.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
      )}

      {canCancel ? (
        <div className="mt-8">
          <CancelBookingButton
            bookingId={booking.id}
            checkIn={booking.check_in}
            createdAt={booking.created_at}
            pricePerNight={room?.price_per_night ?? 0}
            hasCardOnFile={Boolean(getChargeableAuthCode(booking)) && booking.card_reusable !== false}
            amountPaid={booking.amount_paid ?? 0}
          />
        </div>
      ) : (
        <p role="status" className="mt-8 text-sm text-charcoal/60">
          {booking.status === 'cancelled'
            ? MANAGE_BOOKING_MESSAGES.already_cancelled
            : MANAGE_BOOKING_MESSAGES.cancel_locked}
        </p>
      )}
    </main>
  )
}
