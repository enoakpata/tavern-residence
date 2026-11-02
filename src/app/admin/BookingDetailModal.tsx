'use client'

import { useEffect, useState } from 'react'
import { getBookingDetail, type GetBookingDetailResult } from './bookings/actions'
import BookingActions from './bookings/BookingActions'
import PaymentsSection from './bookings/PaymentsSection'
import BookingAuditHistory from './bookings/BookingAuditHistory'
import { resolveTotalAmount, isBookingLocked } from '@/lib/bookingStatus'
import { formatLagosDateTime } from '@/lib/dateUtils'
import { STATUS_STYLES, STATUS_LABELS, PAYMENT_STYLES } from '@/lib/statusStyles'
import { displayRoomCategory, displayRoomName } from '@/lib/roomTypeContent'

export default function BookingDetailModal({
  bookingId,
  onClose,
}: {
  bookingId: string | null
  onClose: () => void
}) {
  const [result, setResult] = useState<GetBookingDetailResult | null>(null)
  const [bookingIdForData, setBookingIdForData] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Bumped on every refetch() — BookingAuditHistory watches this to
  // refresh itself after a room change/early checkout/paid cancellation,
  // none of which otherwise touch its own independently-fetched state.
  const [historyRefreshSignal, setHistoryRefreshSignal] = useState(0)

  // Adjusting state during render (React's documented pattern) — reset
  // immediately when a different booking is requested, so we never flash
  // the previous booking's details while the new one is still loading.
  if (bookingId !== bookingIdForData) {
    setResult(null)
    setLoading(Boolean(bookingId))
    setBookingIdForData(bookingId)
  }

  useEffect(() => {
    if (!bookingId) return
    let cancelled = false
    getBookingDetail(bookingId).then((res) => {
      if (cancelled) return
      setResult(res)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [bookingId])

  function refetch() {
    if (!bookingId) return
    getBookingDetail(bookingId).then((res) => {
      if (bookingId) setResult(res)
    })
    setHistoryRefreshSignal((n) => n + 1)
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

  const booking = result?.status === 'ok' ? result.booking : null

  // Bookings -> Rooms is many-to-one; PostgREST returns a single embedded
  // object at runtime, but without generated schema types supabase-js
  // infers it as an array for this explicit-column select shape.
  const room = booking ? (Array.isArray(booking.Rooms) ? booking.Rooms[0] : booking.Rooms) ?? null : null
  const totalAmount = booking ? resolveTotalAmount(booking, room) : 0
  const locked = booking ? isBookingLocked(booking) : false

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
        ) : result?.status === 'not_found' ? (
          <p className="mt-6 text-sm text-clay">
            Couldn&apos;t find this booking. It may have been removed.
          </p>
        ) : result?.status === 'error' || !booking ? (
          <div className="mt-6 text-sm text-clay">
            <p>Something went wrong loading this booking.</p>
            <button
              type="button"
              onClick={refetch}
              className="mt-2 text-xs underline underline-offset-2"
            >
              Try again
            </button>
          </div>
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

            {locked && (
              <div className="rounded-sm border border-clay/30 bg-clay/5 p-3 text-xs text-charcoal/70">
                <p>This booking is cancelled — nothing on this page can be changed.</p>
                {booking.cancelled_at && (
                  <p className="mt-1">Cancelled {formatLagosDateTime(booking.cancelled_at)}.</p>
                )}
              </div>
            )}

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
                  {room ? `${room.room_number} — ${displayRoomName(room.name)}` : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-charcoal/50">Room type</dt>
                <dd className="mt-1 text-charcoal">{room ? displayRoomCategory(room.room_type) : '—'}</dd>
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
                <dd className="mt-1 text-charcoal">{formatLagosDateTime(booking.created_at)}</dd>
              </div>
              <div>
                <dt className="text-charcoal/50">Card on file</dt>
                <dd className="mt-1 text-charcoal">{booking.has_card_on_file ? 'Yes' : 'No'}</dd>
              </div>
              {booking.early_checkin_fee != null && (
                <div>
                  <dt className="text-charcoal/50">Early check-in</dt>
                  <dd className="mt-1 text-charcoal">
                    Yes — ₦{Number(booking.early_checkin_fee).toLocaleString()}
                  </dd>
                </div>
              )}
              {booking.late_checkout_fee != null && (
                <div>
                  <dt className="text-charcoal/50">Late check-out</dt>
                  <dd className="mt-1 text-charcoal">
                    Yes — ₦{Number(booking.late_checkout_fee).toLocaleString()}
                  </dd>
                </div>
              )}
              {(booking.discount_amount != null || booking.discount_percent != null) && (
                <div className="col-span-2">
                  <dt className="text-charcoal/50">Discount</dt>
                  <dd className="mt-1 text-charcoal">
                    −₦{Number(booking.discount_amount ?? 0).toLocaleString()}
                    {booking.discount_percent != null ? ` (${booking.discount_percent}% off the room)` : ''}
                    {booking.discount_reason ? ` — ${booking.discount_reason}` : ''}
                  </dd>
                </div>
              )}
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

            {booking.special_requests && (
              <div>
                <p className="text-xs tracking-widest text-charcoal/50 uppercase">
                  Special requests
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-charcoal">
                  {booking.special_requests}
                </p>
              </div>
            )}

            <PaymentsSection
              bookingId={booking.id}
              totalAmount={totalAmount}
              amountPaid={booking.amount_paid}
              paymentStatus={booking.payment_status}
              locked={locked}
              guestEmail={booking.guest_email}
              guestPhone={booking.guest_phone}
              onActionComplete={refetch}
            />

            {!locked && (
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
                    hasCardOnFile={booking.card_chargeable}
                    pricePerNight={room?.price_per_night ?? 0}
                    roomName={room?.name ?? null}
                    earlyCheckinFee={booking.early_checkin_fee != null ? Number(booking.early_checkin_fee) : null}
                    lateCheckoutFee={booking.late_checkout_fee != null ? Number(booking.late_checkout_fee) : null}
                    discountAmount={booking.discount_amount}
                    discountPercent={booking.discount_percent}
                    discountReason={booking.discount_reason}
                    promos={result?.status === 'ok' ? result.promotions : []}
                    amountPaid={booking.amount_paid}
                    onActionComplete={refetch}
                  />
                </div>
              </div>
            )}

            <BookingAuditHistory bookingId={booking.id} refreshSignal={historyRefreshSignal} />
          </div>
        )}
      </div>
    </div>
  )
}
