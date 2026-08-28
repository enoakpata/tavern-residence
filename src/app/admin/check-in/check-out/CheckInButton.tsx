'use client'

import { useState, useTransition } from 'react'
import { chargeAndCheckIn, checkInWithoutCharge } from '../../bookings/actions'
import ConfirmModal from '@/components/ConfirmModal'
import { useCheckInResult } from './CheckInResultContext'

export default function CheckInButton({
  bookingId,
  paymentStatus,
  paymentToken,
  guestEmail,
  totalAmount,
}: {
  bookingId: string
  paymentStatus: string
  paymentToken: string | null
  guestEmail: string | null
  totalAmount: number
}) {
  const [isPending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { showResult } = useCheckInResult()

  // payment_method isn't the right signal here — a walk-in who paid via a
  // physical POS card machine also gets payment_method: 'card' recorded,
  // with no Paystack token at all. The actual token's presence is what
  // determines whether there's something chargeable on file.
  const needsCharge = paymentStatus !== 'paid' && Boolean(paymentToken) && Boolean(guestEmail)

  function handleClick() {
    if (needsCharge) {
      setConfirmOpen(true)
      return
    }
    // Re-checked server-side rather than assumed here: already paid ->
    // just flips status; unpaid with nothing chargeable on file (e.g. an
    // unconfirmed transfer) -> blocked with a clear message instead of
    // silently checking in an unpaid guest.
    startTransition(async () => {
      const res = await checkInWithoutCharge(bookingId)
      showResult(
        res.success
          ? { success: true, message: 'Guest checked in.' }
          : { success: false, message: res.error ?? 'Something went wrong.' }
      )
    })
  }

  function handleConfirmCharge() {
    setConfirmOpen(false)
    startTransition(async () => {
      const res = await chargeAndCheckIn(bookingId, paymentToken!, totalAmount, guestEmail!)
      showResult(
        res.success
          ? { success: true, message: `₦${totalAmount.toLocaleString()} charged. Guest checked in.` }
          : { success: false, message: `Card declined: ${res.error ?? 'Charge failed.'}` }
      )
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
