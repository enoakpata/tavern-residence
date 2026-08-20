'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ConfirmModal'
import { cancelBooking } from './actions'

const FREE_CANCELLATION_WINDOW_HOURS = 24

/**
 * Mirrors the server action's own 2:00 PM Lagos time (UTC+1) cutoff, so
 * the confirmation modal shows the right message before the user commits
 * — the server independently re-checks this as the actual authority.
 */
function isWithinFeeWindow(checkIn: string): boolean {
  const checkInMoment = new Date(`${checkIn}T13:00:00Z`)
  const hoursUntilCheckIn = (checkInMoment.getTime() - Date.now()) / (1000 * 60 * 60)
  return hoursUntilCheckIn <= FREE_CANCELLATION_WINDOW_HOURS
}

export default function CancelBookingButton({
  bookingId,
  checkIn,
  totalAmount,
}: {
  bookingId: string
  checkIn: string
  totalAmount: number
}) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  const feeApplies = isWithinFeeWindow(checkIn)
  const feeAmount = Math.round(totalAmount * 0.5)

  const message = feeApplies
    ? `Cancelling now is within 24 hours of check-in. A cancellation fee of ₦${feeAmount.toLocaleString()} will be charged to your card. Continue?`
    : 'Cancel this booking? This is a free cancellation.'

  function handleConfirm() {
    setModalOpen(false)
    startTransition(async () => {
      const res = await cancelBooking(bookingId)
      if (res.success) {
        setResult({
          type: 'success',
          message: res.feeCharged
            ? `Your booking has been cancelled. A cancellation fee of ₦${res.feeAmount.toLocaleString()} was charged to your card.`
            : 'Your booking has been cancelled — no charge.',
        })
        router.refresh()
      } else {
        setResult({ type: 'error', message: res.error })
      }
    })
  }

  if (result?.type === 'success') {
    return <p className="text-sm text-verdant">{result.message}</p>
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        disabled={isPending}
        className="rounded-full border border-clay/40 px-6 py-3 text-sm text-clay transition-colors hover:bg-clay/5 disabled:opacity-50"
      >
        {isPending ? 'Cancelling…' : 'Cancel booking'}
      </button>

      {result?.type === 'error' && <p className="mt-3 text-sm text-clay">{result.message}</p>}

      <ConfirmModal
        open={modalOpen}
        title="Cancel booking"
        message={message}
        confirmLabel={feeApplies ? 'Charge fee & cancel' : 'Cancel booking'}
        cancelLabel="Keep booking"
        onConfirm={handleConfirm}
        onCancel={() => setModalOpen(false)}
      />
    </div>
  )
}
