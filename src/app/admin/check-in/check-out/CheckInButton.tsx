'use client'

import { useTransition } from 'react'
import { updateBookingStatus } from '../../bookings/actions'
import { useActionResult } from './ActionResultContext'

// Payment is manual now (transfer/POS), tracked via the Payments
// ledger on the booking detail panel — check-in no longer charges
// anything itself, it's just the status flip. See
// src/app/admin/bookings/actions.ts (recordPayment/chargeSavedCard) for
// where payment actually gets recorded.
export default function CheckInButton({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition()
  const { showResult } = useActionResult()

  function handleClick() {
    startTransition(async () => {
      const res = await updateBookingStatus(bookingId, 'checked_in')
      showResult(
        res.success
          ? { success: true, title: 'Checked in', message: 'Guest checked in.' }
          : { success: false, title: 'Check-in failed', message: res.error ?? 'Something went wrong.' }
      )
    })
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleClick}
      className="mt-3 w-full rounded-full bg-espresso px-4 py-2 text-xs tracking-widest text-ivory uppercase transition-colors hover:bg-espresso/90 disabled:opacity-50"
    >
      {isPending ? 'Checking in…' : 'Check in'}
    </button>
  )
}
