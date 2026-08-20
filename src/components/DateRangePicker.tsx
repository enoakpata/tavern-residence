'use client'

import { useEffect, useRef, useState } from 'react'
import {
  addMonths,
  buildMonthGrid,
  isDateBlocked,
  isSameDay,
  isWithinRange,
  parseISODate,
  startOfMonth,
  toISODate,
  type BlockedRange,
} from '@/lib/dateUtils'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function DateRangePicker({
  blockedRanges,
  onChange,
  initialCheckIn,
  initialCheckOut,
}: {
  blockedRanges: BlockedRange[]
  onChange: (checkIn: string | null, checkOut: string | null) => void
  initialCheckIn?: string | null
  initialCheckOut?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() =>
    initialCheckIn ? startOfMonth(parseISODate(initialCheckIn)) : startOfMonth(new Date())
  )
  const [checkIn, setCheckIn] = useState<Date | null>(() =>
    initialCheckIn ? parseISODate(initialCheckIn) : null
  )
  const [checkOut, setCheckOut] = useState<Date | null>(() =>
    initialCheckOut ? parseISODate(initialCheckOut) : null
  )
  const containerRef = useRef<HTMLDivElement>(null)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleDayClick(day: Date) {
    if (isBeforeToday(day) || isDateBlocked(day, blockedRanges)) return

    // First click (or restarting after a full range was already picked):
    // set check-in, clear check-out
    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(day)
      setCheckOut(null)
      onChange(toISODate(day), null)
      return
    }

    // Second click: must be strictly after check-in
    if (toISODate(day) <= toISODate(checkIn)) {
      setCheckIn(day)
      setCheckOut(null)
      onChange(toISODate(day), null)
      return
    }

    // Don't allow a range that passes through a blocked date
    const spansBlocked = hasBlockedDateBetween(checkIn, day, blockedRanges)
    if (spansBlocked) {
      setCheckIn(day)
      setCheckOut(null)
      onChange(toISODate(day), null)
      return
    }

    setCheckOut(day)
    onChange(toISODate(checkIn), toISODate(day))
    setOpen(false)
  }

  function isBeforeToday(day: Date) {
    return toISODate(day) < toISODate(today)
  }

  const grid = buildMonthGrid(visibleMonth)
  const monthLabel = visibleMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const displayLabel =
    checkIn && checkOut
      ? `${formatShort(checkIn)} — ${formatShort(checkOut)}`
      : checkIn
        ? `${formatShort(checkIn)} — Select check-out`
        : 'Select dates'

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-sm border border-charcoal/20 px-4 py-3 text-left text-sm focus:border-verdant focus:outline-none"
      >
        <span className={checkIn ? 'text-charcoal' : 'text-charcoal/40'}>
          {displayLabel}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className="text-verdant"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 10h18" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-[320px] rounded-sm border border-charcoal/10 bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setVisibleMonth((m) => addMonths(m, -1))}
              className="rounded-full p-1 text-charcoal/50 hover:bg-verdant/10 hover:text-verdant"
              aria-label="Previous month"
            >
              ←
            </button>
            <p className="font-display text-sm text-charcoal">{monthLabel}</p>
            <button
              type="button"
              onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
              className="rounded-full p-1 text-charcoal/50 hover:bg-verdant/10 hover:text-verdant"
              aria-label="Next month"
            >
              →
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-y-1 text-center text-[11px] tracking-wide text-charcoal/40 uppercase">
            {WEEKDAY_LABELS.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-y-1">
            {grid.map(({ date, inMonth }, i) => {
              const disabled =
                !inMonth || isBeforeToday(date) || isDateBlocked(date, blockedRanges)
              const isCheckIn = checkIn && isSameDay(date, checkIn)
              const isCheckOut = checkOut && isSameDay(date, checkOut)
              const inRange =
                checkIn && checkOut && isWithinRange(date, checkIn, checkOut)

              return (
                <button
                  type="button"
                  key={i}
                  disabled={disabled}
                  onClick={() => handleDayClick(date)}
                  className={[
                    'aspect-square text-xs transition-colors',
                    disabled
                      ? 'cursor-not-allowed text-charcoal/15 line-through'
                      : 'text-charcoal hover:bg-verdant/10',
                    isCheckIn || isCheckOut
                      ? 'bg-verdant text-ivory hover:bg-verdant'
                      : '',
                    inRange && !isCheckIn && !isCheckOut ? 'bg-brass/20' : '',
                  ].join(' ')}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex items-center gap-3 border-t border-charcoal/10 pt-3 text-[11px] text-charcoal/50">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 bg-verdant" /> Selected
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 text-charcoal/15">✕</span> Booked
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function formatShort(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function hasBlockedDateBetween(start: Date, end: Date, blockedRanges: BlockedRange[]) {
  const cursor = new Date(start)
  while (toISODate(cursor) < toISODate(end)) {
    if (isDateBlocked(cursor, blockedRanges)) return true
    cursor.setDate(cursor.getDate() + 1)
  }
  return false
}
