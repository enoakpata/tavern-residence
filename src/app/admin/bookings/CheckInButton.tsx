'use client'

import { useState, useTransition } from 'react'
import { chargeAndCheckIn, updateBookingStatus } from './actions'
import ConfirmModal from '@/components/ConfirmModal'

export default function CheckInButton({
  bookingId,
  paymentMethod,
  paymentStatus,
  paymentToken,
  guestEmail,
  totalAmount,
}: {
  bookingId: string
  paymentMethod: string
  paymentStatus: string
  paymentToken: string | null
  guestEmail: string | null
  totalAmount: number
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const needsCharge =
    paymentMethod === 'card' && paymentToken && paymentStatus !== 'paid' && guestEmail

  function handleClick() {
    setError('')
    if (needsCharge) {
      setConfirmOpen(true)
      return
    }
    // No card to charge (e.g. paid by transfer, or already paid) —
    // nothing to gate check-in on, so just flip the status directly.
    startTransition(async () => {
      const res = await updateBookingStatus(bookingId, 'checked_in')
      if (!res.success) setError(res.error ?? 'Something went wrong.')
    })
  }

  function handleConfirmCharge() {
    setConfirmOpen(false)
    startTransition(async () => {
      const res = await chargeAndCheckIn(bookingId, paymentToken!, totalAmount, guestEmail!)
      if (!res.success) setError(`Card declined: ${res.error ?? 'Charge failed.'}`)
    })
  }

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="mt-3 w-full rounded-full bg-verdant px-4 py-2 text-xs tracking-widest text-ivory uppercase transition-colors hover:bg-verdant/90 disabled:opacity-50"
      >
        {isPending ? 'Checking in…' : 'Check in'}
      </button>
      {error && <p className="mt-2 text-xs text-clay">{error}</p>}

      <ConfirmModal
        open={confirmOpen}
        title="Charge full stay"
        message={`₦${totalAmount.toLocaleString()} will be charged to this guest's saved card, then they'll be checked in.`}
        confirmLabel="Charge & check in"
        onConfirm={handleConfirmCharge}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
