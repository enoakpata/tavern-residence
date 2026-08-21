'use client'

import { useState, useTransition } from 'react'
import { markAsPaid, cancelBookingByStaff, updateBookingStatus } from './actions'
import ConfirmModal from '@/components/ConfirmModal'
import { getCancellationOutcome } from '@/lib/cancellationPolicy'

type BookingActionsProps = {
  bookingId: string
  status: string
  checkIn: string
  createdAt: string
  guestName: string
  roomNumber: string
  paymentMethod: string
  paymentStatus: string
  paymentToken: string | null
  totalAmount: number
}

const CANCELLABLE_STATUSES = ['pending', 'confirmed']

export default function BookingActions({
  bookingId,
  status,
  checkIn,
  createdAt,
  guestName,
  roomNumber,
  paymentMethod,
  paymentStatus,
  paymentToken,
  totalAmount,
}: BookingActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [pendingCancel, setPendingCancel] = useState<
    null | { feeApplies: boolean; feeAmount: number }
  >(null)
  const [pendingCheckout, setPendingCheckout] = useState(false)

  function run(
    action: () => Promise<{ success: boolean; error?: string }>,
    errorPrefix = ''
  ) {
    setError('')
    startTransition(async () => {
      const res = await action()
      if (!res.success) setError(`${errorPrefix}${res.error ?? 'Something went wrong.'}`)
    })
  }

  const canCancel = CANCELLABLE_STATUSES.includes(status)
  const canCheckOut = status === 'checked_in'

  function handleCancelClick() {
    // No saved card to charge (e.g. paid by transfer) — always the simple
    // free-cancellation confirm, regardless of timing.
    if (paymentMethod !== 'card' || !paymentToken) {
      setPendingCancel({ feeApplies: false, feeAmount: 0 })
      return
    }
    // totalAmount is already pricePerNight × nights, so passing it as
    // pricePerNight with nights: 1 yields the same fee without this
    // component needing the two figures split out separately. A booking
    // whose check-in date has already passed naturally falls into the fee
    // branch here too (hoursUntilCheckIn goes negative), which is how a
    // no-show gets its 50% fee without needing a separate button.
    const { free, feeAmount } = getCancellationOutcome({
      createdAt,
      checkIn,
      pricePerNight: totalAmount,
      nights: 1,
    })
    setPendingCancel({ feeApplies: !free, feeAmount })
  }

  function handleConfirmCancel() {
    setPendingCancel(null)
    run(() => cancelBookingByStaff(bookingId))
  }

  function handleConfirmCheckout() {
    setPendingCheckout(false)
    run(() => updateBookingStatus(bookingId, 'checked_out'))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {paymentMethod === 'transfer' && paymentStatus === 'awaiting_verification' && (
        <button
          disabled={isPending}
          onClick={() => run(() => markAsPaid(bookingId))}
          className="rounded-full bg-verdant/10 px-3 py-1 text-xs text-verdant hover:bg-verdant/20 disabled:opacity-50"
        >
          Mark as paid
        </button>
      )}

      {canCheckOut && (
        <button
          disabled={isPending}
          onClick={() => setPendingCheckout(true)}
          className="rounded-full bg-verdant px-3 py-1 text-xs text-ivory hover:bg-verdant/90 disabled:opacity-50"
        >
          Check out
        </button>
      )}

      {canCancel && (
        <button
          disabled={isPending}
          onClick={handleCancelClick}
          className="rounded-full border border-charcoal/20 px-3 py-1 text-xs text-charcoal/70 hover:bg-charcoal/5 disabled:opacity-50"
        >
          Cancel booking
        </button>
      )}

      {error && <p className="w-full text-xs text-clay">{error}</p>}

      <ConfirmModal
        open={pendingCancel !== null}
        title="Cancel booking"
        message={
          pendingCancel?.feeApplies
            ? `Cancelling now is within 24 hours of check-in. A cancellation fee of ₦${pendingCancel.feeAmount.toLocaleString()} will be charged to this guest's saved card. Continue?`
            : 'Cancel this booking? This is a free cancellation.'
        }
        confirmLabel={pendingCancel?.feeApplies ? 'Charge fee & cancel' : 'Cancel booking'}
        onConfirm={handleConfirmCancel}
        onCancel={() => setPendingCancel(null)}
      />

      <ConfirmModal
        open={pendingCheckout}
        title="Check out guest"
        message={`Check out ${guestName} from Room ${roomNumber}? This will make the room available for new bookings again.`}
        confirmLabel="Check out"
        onConfirm={handleConfirmCheckout}
        onCancel={() => setPendingCheckout(false)}
      />
    </div>
  )
}
