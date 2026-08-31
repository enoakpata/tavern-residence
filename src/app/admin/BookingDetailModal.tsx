'use client'

import { useEffect, useState } from 'react'
import { getBookingDetail } from './bookings/actions'
import BookingActions from './bookings/BookingActions'
import { STATUS_STYLES, PAYMENT_STYLES } from '@/lib/statusStyles'

type BookingDetail = Awaited<ReturnType<typeof getBookingDetail>>

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending confirmation',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  cancelled: 'Cancelled',
  no_show: 'No-show',
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function BookingDetailModal({
  bookingId,
  onClose,
}: {
  bookingId: string | null
  onClose: () => void
}) {
  const [booking, setBooking] = useState<BookingDetail>(null)
  const [bookingIdForData, setBookingIdForData] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Adjusting state during render (React's documented pattern) — reset
  // immediately when a different booking is requested, so we never flash
  // the previous booking's details while the new one is still loading.
  if (bookingId !== bookingIdForData) {
    setBooking(null)
    setLoading(Boolean(bookingId))
    setBookingIdForData(bookingId)
  }

  useEffect(() => {
    if (!bookingId) return
    let cancelled = false
    getBookingDetail(bookingId).then((result) => {
      if (cancelled) return
      setBooking(result)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [bookingId])

  function refetch() {
    if (!bookingId) return
    getBookingDetail(bookingId).then((result) => {
      if (bookingId) setBooking(result)
    })
  }

  useEffect(() => {
    if (!bookingId) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [bookingId, onClose])

  if (!bookingId) return null

  const room = booking?.Rooms ?? null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/50 px-4 py-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-detail-title"
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-sm border border-charcoal/10 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <p id="booking-detail-title" className="font-display text-xl text-charcoal">
            Booking detail
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg leading-none text-charcoal/40 transition-colors hover:bg-charcoal/10 hover:text-charcoal"
          >
            ×
          </button>
        </div>

        {loading && !booking ? (
          <p className="mt-6 text-sm text-charcoal/50">Loading…</p>
        ) : !booking ? (
          <p className="mt-6 text-sm text-clay">
            Couldn&apos;t load this booking. It may have been removed.
          </p>
        ) : (
          <div className="mt-4 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs capitalize ${STATUS_STYLES[booking.status] ?? 'bg-charcoal/10 text-charcoal/60'}`}
              >
                {STATUS_LABELS[booking.status] ?? booking.status}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs capitalize ${PAYMENT_STYLES[booking.payment_status] ?? 'bg-charcoal/10 text-charcoal/60'}`}
              >
                {booking.payment_status.replace('_', ' ')}
              </span>
            </div>

            <div>
              <p className="font-display text-lg text-charcoal">{booking.guest_name}</p>
              <p className="mt-1 text-sm text-charcoal/60">{booking.guest_phone}</p>
              {booking.guest_email && (
                <p className="text-sm text-charcoal/60">{booking.guest_email}</p>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-4 border-y border-charcoal/10 py-4 text-sm">
              <div>
                <dt className="text-charcoal/50">Room</dt>
                <dd className="mt-1 text-charcoal">
                  {room ? `${room.room_number} — ${room.name}` : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-charcoal/50">Room type</dt>
                <dd className="mt-1 text-charcoal">{room?.room_type ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-charcoal/50">Check-in</dt>
                <dd className="mt-1 text-charcoal">{booking.check_in}</dd>
              </div>
              <div>
                <dt className="text-charcoal/50">Check-out</dt>
                <dd className="mt-1 text-charcoal">{booking.check_out}</dd>
              </div>
              <div>
                <dt className="text-charcoal/50">Source</dt>
                <dd className="mt-1 text-charcoal capitalize">{booking.source.replace('_', ' ')}</dd>
              </div>
              <div>
                <dt className="text-charcoal/50">Booked</dt>
                <dd className="mt-1 text-charcoal">{formatDateTime(booking.created_at)}</dd>
              </div>
              <div>
                <dt className="text-charcoal/50">Payment method</dt>
                <dd className="mt-1 text-charcoal capitalize">{booking.payment_method}</dd>
              </div>
              <div>
                <dt className="text-charcoal/50">Card on file</dt>
                <dd className="mt-1 text-charcoal">{booking.payment_token ? 'Yes' : 'No'}</dd>
              </div>
              {booking.charge_type && (
                <div>
                  <dt className="text-charcoal/50">Charge type</dt>
                  <dd className="mt-1 text-charcoal capitalize">
                    {booking.charge_type.replace(/_/g, ' ')}
                  </dd>
                </div>
              )}
              {booking.amount_charged != null && (
                <div>
                  <dt className="text-charcoal/50">Amount charged</dt>
                  <dd className="mt-1 text-charcoal">
                    ₦{booking.amount_charged.toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>

            <div>
              <p className="text-xs tracking-widest text-charcoal/50 uppercase">Actions</p>
              <div className="mt-3">
                <BookingActions
                  bookingId={booking.id}
                  status={booking.status}
                  checkIn={booking.check_in}
                  checkOut={booking.check_out}
                  createdAt={booking.created_at}
                  guestName={booking.guest_name}
                  roomNumber={room?.room_number ?? ''}
                  paymentStatus={booking.payment_status}
                  paymentToken={booking.payment_token}
                  pricePerNight={room?.price_per_night ?? 0}
                  onActionComplete={refetch}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
