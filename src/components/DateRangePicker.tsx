'use client'

import { useEffect, useRef, useState } from 'react'
import { Calendar } from 'lucide-react'
import {
  addMonths,
  buildMonthGrid,
  isDateBlocked,
  isSameDay,
  isWithinRange,
  parseISODate,
  startOfMonth,
  toISODate,
  todayInLagos,
  type BlockedRange,
} from '@/lib/dateUtils'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
// Same drag-gesture threshold used by the photo galleries
// (RoomGallery.tsx / AmbientGallery.tsx) for consistent swipe feel.
const DRAG_THRESHOLD = 50

export default function DateRangePicker({
  blockedRanges,
  onChange,
  initialCheckIn,
  initialCheckOut,
  size = 'default',
  theme = 'light',
  mode = 'range',
  minDate = null,
  bare = false,
}: {
  blockedRanges: BlockedRange[]
  onChange: (checkIn: string | null, checkOut: string | null) => void
  initialCheckIn?: string | null
  initialCheckOut?: string | null
  size?: 'default' | 'large'
  theme?: 'light' | 'dark'
  // Drops the trigger button's own border/padding, for callers embedding
  // this inside a container that already supplies its own visual frame
  // (e.g. the homepage booking widget's hairline-divided card) — every
  // other behavior is unchanged.
  bare?: boolean
  // 'single' collects just one date in one click — the selected day is
  // reported as the first (checkIn) onChange argument, with the second
  // always null. Used for editing just a check-out date, where forcing
  // the normal two-click range flow would make no sense.
  mode?: 'range' | 'single'
  // Earliest selectable date (ISO), for callers needing a bound beyond
  // "not before today" — e.g. a new check-out must fall after a fixed,
  // already-passed check-in.
  minDate?: string | null
}) {
  const isLarge = size === 'large'
  const isDark = theme === 'dark'

  // A range restored from a URL/prop on mount is only trusted if neither
  // end has already passed — a bookmarked or shared link (or just an old
  // tab left open) can easily carry a check-in/check-out that's since
  // slipped into the past. Compared as plain ISO strings against "today"
  // in the hotel's own timezone (not the visitor's device clock), same as
  // todayInLagos()'s other call sites — if either half is stale, the
  // whole pair is dropped rather than restoring a half-broken selection.
  const initialRangeIsStale =
    (initialCheckIn != null && initialCheckIn < todayInLagos()) ||
    (initialCheckOut != null && initialCheckOut < todayInLagos())
  const seedCheckIn = !initialRangeIsStale ? initialCheckIn : null
  const seedCheckOut = !initialRangeIsStale ? initialCheckOut : null

  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() =>
    seedCheckIn ? startOfMonth(parseISODate(seedCheckIn)) : startOfMonth(new Date())
  )
  const [checkIn, setCheckIn] = useState<Date | null>(() =>
    seedCheckIn ? parseISODate(seedCheckIn) : null
  )
  const [checkOut, setCheckOut] = useState<Date | null>(() =>
    seedCheckOut ? parseISODate(seedCheckOut) : null
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartX = useRef(0)

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

  function handleCalendarPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    dragStartX.current = e.clientX
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handleCalendarPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging) return
    setIsDragging(false)
    const deltaX = e.clientX - dragStartX.current
    if (deltaX > DRAG_THRESHOLD) {
      setVisibleMonth((m) => addMonths(m, -1))
    } else if (deltaX < -DRAG_THRESHOLD) {
      setVisibleMonth((m) => addMonths(m, 1))
    }
  }

  function handleCalendarPointerCancel() {
    setIsDragging(false)
  }

  function handleDayClick(day: Date) {
    if (isBeforeToday(day) || isBeforeMinDate(day) || isDateBlocked(day, blockedRanges)) return

    if (mode === 'single') {
      setCheckIn(day)
      setCheckOut(null)
      onChange(toISODate(day), null)
      setOpen(false)
      return
    }

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

  function isBeforeMinDate(day: Date) {
    return minDate ? toISODate(day) < minDate : false
  }

  const grid = buildMonthGrid(visibleMonth)
  const monthLabel = visibleMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const displayLabel =
    mode === 'single'
      ? checkIn
        ? formatShort(checkIn)
        : 'Select date'
      : checkIn && checkOut
        ? `${formatShort(checkIn)} — ${formatShort(checkOut)}`
        : checkIn
          ? `${formatShort(checkIn)} — Select check-out`
          : 'Select dates'

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 text-left focus:outline-none ${
          bare
            ? ''
            : `rounded-sm border ${
                isDark ? 'border-ivory/40 focus:border-brass' : 'border-charcoal/20 focus:border-verdant'
              } ${isLarge ? 'px-6 py-5 text-base' : 'px-4 py-3 text-sm'}`
        }`}
      >
        <Calendar
          size={isLarge ? 16 : 14}
          className={`shrink-0 ${isDark ? 'text-brass' : 'text-verdant'}`}
        />
        <span
          className={
            isDark
              ? checkIn
                ? 'text-ivory'
                : 'text-ivory/50'
              : checkIn
                ? 'text-charcoal'
                : 'text-charcoal/40'
          }
        >
          {displayLabel}
        </span>
      </button>

      {open && (
        <div
          className={`absolute z-20 mt-2 rounded-sm border border-charcoal/10 bg-white shadow-xl ${
            isLarge
              ? 'w-[min(300px,calc(100vw-2rem))] p-4'
              : 'w-[min(260px,calc(100vw-2rem))] p-3'
          }`}
        >
          <div
            className={`flex select-none touch-pan-y items-center justify-between ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            onPointerDown={handleCalendarPointerDown}
            onPointerUp={handleCalendarPointerUp}
            onPointerCancel={handleCalendarPointerCancel}
            onPointerLeave={handleCalendarPointerCancel}
          >
            <button
              type="button"
              onClick={() => setVisibleMonth((m) => addMonths(m, -1))}
              onPointerDown={(e) => e.stopPropagation()}
              className={`rounded-full p-1 text-charcoal/50 hover:bg-verdant/10 hover:text-verdant ${isLarge ? 'text-sm' : 'text-xs'}`}
              aria-label="Previous month"
            >
              ←
            </button>
            <p className={`font-display text-charcoal ${isLarge ? 'text-sm' : 'text-xs'}`}>
              {monthLabel}
            </p>
            <button
              type="button"
              onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
              onPointerDown={(e) => e.stopPropagation()}
              className={`rounded-full p-1 text-charcoal/50 hover:bg-verdant/10 hover:text-verdant ${isLarge ? 'text-sm' : 'text-xs'}`}
              aria-label="Next month"
            >
              →
            </button>
          </div>

          <div
            className={`mt-2 grid grid-cols-7 justify-items-center gap-y-1 text-center tracking-wide text-charcoal/40 uppercase ${
              isLarge ? 'text-[11px]' : 'text-[10px]'
            }`}
          >
            {WEEKDAY_LABELS.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>

          <div
            className={`mt-2 grid grid-cols-7 justify-items-center ${isLarge ? 'gap-y-1' : 'gap-y-0.5'}`}
          >
            {grid.map(({ date, inMonth }, i) => {
              const disabled =
                !inMonth ||
                isBeforeToday(date) ||
                isBeforeMinDate(date) ||
                isDateBlocked(date, blockedRanges)
              const isCheckIn = checkIn && isSameDay(date, checkIn)
              const isCheckOut = checkOut && isSameDay(date, checkOut)
              const isSelected = isCheckIn || isCheckOut
              const inRange =
                checkIn && checkOut && isWithinRange(date, checkIn, checkOut)
              const isToday = isSameDay(date, today)

              return (
                <button
                  type="button"
                  key={i}
                  disabled={disabled}
                  onClick={() => handleDayClick(date)}
                  className={[
                    'aspect-square w-full transition-colors',
                    isLarge ? 'text-xs md:text-sm' : 'text-[11px]',
                    disabled
                      ? 'cursor-not-allowed text-charcoal/25'
                      : 'text-charcoal hover:bg-verdant/10',
                    isSelected ? 'bg-verdant text-ivory hover:bg-verdant' : '',
                    inRange && !isSelected ? 'bg-brass/20' : '',
                    // A subtle ring marks today when it isn't otherwise
                    // selected — the selected fill above always wins, and
                    // the ring never breaks the in-range band's square
                    // cells from touching seamlessly along a run of days.
                    isToday && !isSelected ? 'ring-1 ring-inset ring-verdant/50' : '',
                  ].join(' ')}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          <div
            className={`mt-2 flex items-center gap-3 border-t border-charcoal/10 pt-2 text-charcoal/50 ${
              isLarge ? 'text-[11px]' : 'text-[10px]'
            }`}
          >
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 bg-verdant" /> Selected
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-charcoal/25" /> Booked
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
