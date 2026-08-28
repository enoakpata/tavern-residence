'use client'

import { createContext, useContext, useState } from 'react'
import BookingDetailModal from './BookingDetailModal'

const BookingDetailContext = createContext<{ open: (bookingId: string) => void } | null>(null)

// Lives at the admin layout level so any admin page — the bookings table,
// the notification dropdown in the header, anywhere else later — can open
// the same booking detail view just by knowing a booking_id, without each
// needing its own copy of the modal or its own fetch logic.
export function BookingDetailProvider({ children }: { children: React.ReactNode }) {
  const [bookingId, setBookingId] = useState<string | null>(null)

  return (
    <BookingDetailContext.Provider value={{ open: setBookingId }}>
      {children}
      <BookingDetailModal bookingId={bookingId} onClose={() => setBookingId(null)} />
    </BookingDetailContext.Provider>
  )
}

export function useBookingDetail() {
  const ctx = useContext(BookingDetailContext)
  if (!ctx) {
    throw new Error('useBookingDetail must be used within BookingDetailProvider')
  }
  return ctx
}
