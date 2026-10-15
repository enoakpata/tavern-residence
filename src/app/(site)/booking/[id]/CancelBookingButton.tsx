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
  hasCardOnFile,
}: {
  bookingId: string
  checkIn: string
  createdAt: string
  pricePerNight: number
  // Derived server-side — never the actual card token. See
  // src/app/(site)/booking/[id]/page.tsx.
  hasCardOnFile: boolean
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
  const feeMayApply = feeApplies && hasCardOnFile

  // Cancellation itself never charges a card automatically — a fee
  // outside the free window only applies if our team follows up and
  // applies it manually, per policy.
  const message = feeMayApply
    ? `Per our cancellation policy: ${reason} Our team will follow up about this — continue?`
    : 'Cancel this booking? This is a free cancellation.'

  function handleConfirm() {
    setModalOpen(false)
    startTransition(async () => {
      const res = await cancelBooking(bookingId)
      if (res.success) {
        setResult({
          type: 'success',
          message: res.feeMayApply
            ? `Your booking has been cancelled. A ₦${res.feeAmount.toLocaleString()} cancellation fee may apply per our policy — we'll be in touch.`
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
        confirmLabel="Cancel booking"
        cancelLabel="Keep booking"
        onConfirm={handleConfirm}
        onCancel={() => setModalOpen(false)}
      />
    </div>
  )
}
