'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ConfirmModal'
import { getCancellationOutcome } from '@/lib/cancellationPolicy'
import { cancelBooking } from './actions'

export default function CancelBookingButton({
  bookingId,
  checkIn,
  createdAt,
  pricePerNight,
  paymentToken,
}: {
  bookingId: string
  checkIn: string
  createdAt: string
  pricePerNight: number
  paymentToken: string | null
}) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  const { free, feeAmount } = getCancellationOutcome({
    createdAt,
    checkIn,
    pricePerNight,
  })
  // No actual chargeable token on file (e.g. paid by transfer, or a
  // walk-in who paid by POS card with no Paystack token recorded) — the
  // server cancels this for free in that case, so the preview shouldn't
  // tell the guest a card is about to be charged.
  const feeApplies = !free && Boolean(paymentToken)

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
