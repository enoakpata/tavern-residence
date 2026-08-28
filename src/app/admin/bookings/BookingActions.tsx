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
  paymentStatus: string
  paymentToken: string | null
  pricePerNight: number
  // Called after any action succeeds — lets a parent that's showing its
  // own snapshot of this booking (the detail modal, which fetches once
  // when opened) know to refetch, since revalidatePath only refreshes the
  // underlying page's Server Components, not this client-held snapshot.
  onActionComplete?: () => void
}

const CANCELLABLE_STATUSES = ['pending', 'confirmed']

export default function BookingActions({
  bookingId,
  status,
  checkIn,
  createdAt,
  guestName,
  roomNumber,
  paymentStatus,
  paymentToken,
  pricePerNight,
  onActionComplete,
}: BookingActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [pendingCancel, setPendingCancel] = useState<
    null | { feeApplies: boolean; feeAmount: number }
  >(null)
  const [pendingCheckout, setPendingCheckout] = useState(false)
  const [cancelResult, setCancelResult] = useState<null | { success: boolean; message: string }>(
    null
  )

  function run(
    action: () => Promise<{ success: boolean; error?: string }>,
    errorPrefix = ''
  ) {
    setError('')
    startTransition(async () => {
      const res = await action()
      if (!res.success) {
        setError(`${errorPrefix}${res.error ?? 'Something went wrong.'}`)
      } else {
        onActionComplete?.()
      }
    })
  }

  const canCancel = CANCELLABLE_STATUSES.includes(status)
  const canCheckOut = status === 'checked_in'

  function handleCancelClick() {
    // No actual chargeable token on file (e.g. paid by transfer, or a
    // walk-in who paid by POS card with no Paystack token recorded) —
    // always the simple free-cancellation confirm, regardless of timing.
    // payment_method alone isn't the right signal here: a walk-in can have
    // payment_method 'card' with no token at all.
    if (!paymentToken) {
      setPendingCancel({ feeApplies: false, feeAmount: 0 })
      return
    }
    // A booking whose check-in date has already passed naturally falls
    // into the fee branch here too (hoursUntilCheckIn goes negative),
    // which is how a no-show gets its 50% fee without needing a separate
    // button.
    const { free, feeAmount } = getCancellationOutcome({
      createdAt,
      checkIn,
      pricePerNight,
    })
    setPendingCancel({ feeApplies: !free, feeAmount })
  }

  function handleConfirmCancel() {
    setPendingCancel(null)
    setError('')
    startTransition(async () => {
      const res = await cancelBookingByStaff(bookingId)
      if (res.success) {
        setCancelResult({
          success: true,
          message: res.feeCharged
            ? `Booking cancelled. A cancellation fee of ₦${res.feeAmount.toLocaleString()} was charged to the guest's card.`
            : 'Booking cancelled — no fee charged.',
        })
        onActionComplete?.()
      } else {
        setCancelResult({ success: false, message: res.error })
      }
    })
  }

  function handleConfirmCheckout() {
    setPendingCheckout(false)
    run(() => updateBookingStatus(bookingId, 'checked_out'))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {paymentStatus === 'unpaid' && (
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

      <ConfirmModal
        open={cancelResult !== null}
        title={cancelResult?.success ? 'Booking cancelled' : 'Cancellation failed'}
        message={cancelResult?.message ?? ''}
        confirmLabel="OK"
        hideCancel
        onConfirm={() => setCancelResult(null)}
        onCancel={() => setCancelResult(null)}
      />
    </div>
  )
}
