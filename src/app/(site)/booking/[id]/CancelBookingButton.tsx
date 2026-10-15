'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ConfirmModal'
import { getCancellationOutcome } from '@/lib/cancellationPolicy'
import {
  MANAGE_BOOKING_MESSAGES,
  cancellationPreviewMessage,
  cancellationSuccessMessage,
} from '@/lib/manageBookingMessages'
import { cancelBooking } from './actions'

export default function CancelBookingButton({
  bookingId,
  checkIn,
  createdAt,
  pricePerNight,
  hasCardOnFile,
  amountPaid,
}: {
  bookingId: string
  checkIn: string
  createdAt: string
  pricePerNight: number
  // Derived server-side — never the actual card token. See
  // src/app/(site)/booking/[id]/page.tsx.
  hasCardOnFile: boolean
  amountPaid: number
}) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  const { feeApplies, reason } = getCancellationOutcome({
    createdAt,
    checkIn,
    pricePerNight,
  })
  const alreadyPaid = amountPaid > 0
  const feeMayApply = feeApplies && hasCardOnFile && !alreadyPaid

  // Cancellation itself never charges a card automatically — a fee
  // outside the free window only applies if our team follows up and
  // applies it manually, per policy (and never if the stay's already
  // been paid for — see cancellationPreviewMessage).
  const message = cancellationPreviewMessage({ feeMayApply, reason, alreadyPaid })

  function handleConfirm() {
    setModalOpen(false)
    startTransition(async () => {
      const res = await cancelBooking(bookingId)
      if (res.success) {
        setResult({
          type: 'success',
          message: cancellationSuccessMessage(res),
        })
        router.refresh()
      } else {
        setResult({ type: 'error', message: MANAGE_BOOKING_MESSAGES[res.code] })
      }
    })
  }

  if (result?.type === 'success') {
    return (
      <p role="status" className="text-sm text-verdant">
        {result.message}
      </p>
    )
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

      {result?.type === 'error' && (
        <p role="alert" className="mt-3 text-sm text-clay">
          {result.message}
        </p>
      )}

      <ConfirmModal
        open={modalOpen}
        title="Cancel booking"
        message={message}
        confirmLabel="Cancel booking"
        cancelLabel="Keep booking"
        onConfirm={handleConfirm}
        onCancel={() => setModalOpen(false)}
      />
    </div>
  )
}
