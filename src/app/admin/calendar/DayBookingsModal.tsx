'use client'

import { useEffect } from 'react'
import { parseISODate } from '@/lib/dateUtils'
import { STATUS_STYLES } from '@/lib/statusStyles'
import type { DayBookingEntry } from './CalendarGrid'

const PAYMENT_LABELS: Record<string, string> = {
  card: 'Card',
  transfer: 'Bank transfer',
}

const SOURCE_LABELS: Record<string, string> = {
  online: 'Online',
  walk_in: 'Walk-in',
  phone: 'Phone',
}

export default function DayBookingsModal({
  date,
  bookings,
  onClose,
}: {
  date: string | null
  bookings: DayBookingEntry[]
  onClose: () => void
}) {
  useEffect(() => {
    if (!date) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [date, onClose])

  if (!date) return null

  const dateLabel = parseISODate(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/50 px-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-bookings-title"
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-sm border border-charcoal/10 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-widest text-brass uppercase">
              Bookings
            </p>
            <p id="day-bookings-title" className="mt-1 font-display text-xl text-charcoal">
              {dateLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-lg text-charcoal/40 transition-colors hover:text-charcoal"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {bookings.map((booking, i) => (
            <div key={i} className="rounded-sm border border-charcoal/10 p-4 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs tracking-widest text-brass uppercase">
                  Room {booking.roomNumber}
                </p>
                <span
                  className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] capitalize ${STATUS_STYLES[booking.status] ?? 'bg-charcoal/10 text-charcoal/60'}`}
                >
                  {booking.status.replace('_', ' ')}
                </span>
              </div>
              <p className="mt-2 text-charcoal">{booking.guestName}</p>
              <p className="text-charcoal/60">{booking.guestPhone}</p>
              <div className="mt-3 flex gap-2 text-xs text-charcoal/60">
                <span className="rounded-full bg-charcoal/5 px-2 py-1">
                  {PAYMENT_LABELS[booking.paymentMethod] ?? booking.paymentMethod}
                </span>
                <span className="rounded-full bg-charcoal/5 px-2 py-1">
                  {SOURCE_LABELS[booking.source] ?? booking.source}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-charcoal/20 px-4 py-2 text-sm text-charcoal/70 transition-colors hover:bg-charcoal/5"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
