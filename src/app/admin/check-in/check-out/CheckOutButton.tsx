'use client'

import { useState, useTransition } from 'react'
import { updateBookingStatus } from '../../bookings/actions'
import ConfirmModal from '@/components/ConfirmModal'
import { useActionResult } from './ActionResultContext'

export default function CheckOutButton({
  bookingId,
  guestName,
  roomNumber,
}: {
  bookingId: string
  guestName: string
  roomNumber: string
}) {
  const [isPending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { showResult } = useActionResult()

  function handleConfirm() {
    setConfirmOpen(false)
    startTransition(async () => {
      const res = await updateBookingStatus(bookingId, 'checked_out')
      showResult(
        res.success
          ? { success: true, title: 'Checked out', message: 'Guest checked out.' }
          : { success: false, title: 'Check-out failed', message: res.error ?? 'Something went wrong.' }
      )
    })
  }

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => setConfirmOpen(true)}
        className="mt-3 w-full rounded-full bg-verdant px-4 py-2 text-xs tracking-widest text-ivory uppercase transition-colors hover:bg-verdant/90 disabled:opacity-50"
      >
        {isPending ? 'Checking out…' : 'Check out'}
      </button>

      <ConfirmModal
        open={confirmOpen}
        title="Check out guest"
        message={`Check out ${guestName} from Room ${roomNumber}?`}
        confirmLabel="Check out"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
