'use client'

import { useState, useTransition } from 'react'
import { updateBookingStatus } from './actions'
import ConfirmModal from '@/components/ConfirmModal'

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
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  function handleConfirm() {
    setConfirmOpen(false)
    startTransition(async () => {
      const res = await updateBookingStatus(bookingId, 'checked_out')
      if (!res.success) setError(res.error ?? 'Something went wrong.')
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
      {error && <p className="mt-2 text-xs text-clay">{error}</p>}

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
