'use client'

import { useBookingDetail } from '../BookingDetailContext'

export default function ViewBookingButton({ bookingId }: { bookingId: string }) {
  const { open } = useBookingDetail()

  return (
    <button
      type="button"
      onClick={() => open(bookingId)}
      className="rounded-full border border-charcoal/20 px-3 py-1 text-xs text-charcoal/70 hover:bg-charcoal/5"
    >
      View
    </button>
  )
}
