'use client'

import { useState } from 'react'
import { buildMonthGrid, isSameDay, parseISODate, toISODate } from '@/lib/dateUtils'
import DayBookingsModal from './DayBookingsModal'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_VISIBLE_BADGES = 4

export type DayBookingEntry = {
  roomNumber: string
  guestName: string
  guestPhone: string
  paymentMethod: string
  source: string
}

export default function CalendarGrid({
  visibleMonth,
  bookingsByDate,
}: {
  visibleMonth: string
  bookingsByDate: Record<string, DayBookingEntry[]>
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const grid = buildMonthGrid(parseISODate(visibleMonth))
  const today = new Date()

  return (
    <>
      <div className="mt-8 overflow-hidden rounded-sm border border-charcoal/10 bg-white">
        <div className="grid grid-cols-7 border-b border-charcoal/10">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="px-2 py-2 text-center text-[11px] tracking-widest text-charcoal/50 uppercase"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {grid.map(({ date, inMonth }, i) => {
            const iso = toISODate(date)
            const dayBookings = bookingsByDate[iso] ?? []
            const hasBookings = dayBookings.length > 0
            const isToday = isSameDay(date, today)

            return (
              <button
                type="button"
                key={i}
                disabled={!hasBookings}
                onClick={() => setSelectedDate(iso)}
                className={[
                  'flex min-h-24 flex-col items-start gap-1.5 border-b border-r border-charcoal/10 p-2 text-left transition-colors',
                  inMonth ? 'bg-white' : 'bg-ivory/60',
                  hasBookings ? 'cursor-pointer hover:bg-verdant/5' : 'cursor-default',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                    isToday
                      ? 'bg-brass/15 font-semibold text-charcoal ring-1 ring-brass'
                      : inMonth
                        ? 'text-charcoal'
                        : 'text-charcoal/30',
                  ].join(' ')}
                >
                  {date.getDate()}
                </span>

                {hasBookings && (
                  <div className="flex flex-wrap gap-1">
                    {dayBookings.slice(0, MAX_VISIBLE_BADGES).map((booking, idx) => (
                      <span
                        key={idx}
                        className="rounded-full bg-verdant/15 px-2 py-0.5 text-[10px] text-verdant"
                      >
                        {booking.roomNumber}
                      </span>
                    ))}
                    {dayBookings.length > MAX_VISIBLE_BADGES && (
                      <span className="rounded-full bg-charcoal/10 px-2 py-0.5 text-[10px] text-charcoal/60">
                        +{dayBookings.length - MAX_VISIBLE_BADGES}
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <DayBookingsModal
        date={selectedDate}
        bookings={selectedDate ? (bookingsByDate[selectedDate] ?? []) : []}
        onClose={() => setSelectedDate(null)}
      />
    </>
  )
}
