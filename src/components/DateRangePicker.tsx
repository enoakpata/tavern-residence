'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
// Same drag-gesture threshold used by the room photo gallery
// (RoomGallery.tsx) for consistent swipe feel.
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
  maxDate = null,
  allowPast = false,
  bare = false,
  inline = false,
  showBookedLegend = true,
  anchor = 'relative',
}: {
  blockedRanges: BlockedRange[]
  onChange: (checkIn: string | null, checkOut: string | null) => void
  initialCheckIn?: string | null
  initialCheckOut?: string | null
  // 'compact' is for a short single-value field (e.g. a payment date)
  // where the full-size calendar reads as oversized — smaller popover
  // width, day cells, and type throughout.
  size?: 'default' | 'large' | 'compact'
  theme?: 'light' | 'dark'
  // Drops the trigger button's own border/padding, for callers embedding
  // this inside a container that already supplies its own visual frame
  // (e.g. the homepage booking widget's hairline-divided card) — every
  // other behavior is unchanged.
  bare?: boolean
  // Presentation-only: show the existing calendar directly in the page.
  inline?: boolean
  // 'single' collects just one date in one click — the selected day is
  // reported as the first (checkIn) onChange argument, with the second
  // always null. Used for editing just a check-out date, where forcing
  // the normal two-click range flow would make no sense.
  mode?: 'range' | 'single'
  // Earliest selectable date (ISO), for callers needing a bound beyond
  // "not before today" — e.g. a new check-out must fall after a fixed,
  // already-passed check-in.
  minDate?: string | null
  // Latest selectable date (ISO) — for callers needing an upper bound,
  // e.g. a payment date that can't be in the future.
  maxDate?: string | null
  // Lets past dates be selected — for callers recording something that
  // already happened (e.g. a payment date), as opposed to booking a
  // future stay, which always blocks the past regardless of this flag.
  allowPast?: boolean
  // Hides the "Booked" legend entry — for a calendar with no concept of
  // blocked dates at all (blockedRanges always []), where it would just
  // be confusing, unexplained clutter.
  showBookedLegend?: boolean
  // 'relative' (default): the popover is positioned absolute to its own
  // trigger, same as always. 'viewport': computed as position:fixed from
  // the trigger's live bounding box instead — for a trigger that sits
  // inside a scrollable container (e.g. the admin booking detail modal),
  // where a plain absolute popover can be silently clipped by that
  // container's own overflow, cutting off the day grid and legend below
  // the trigger. Closes on scroll, since a fixed position computed once
  // at open time would otherwise drift out of alignment with the
  // trigger as the container scrolls.
  anchor?: 'relative' | 'viewport'
}) {
  const isLarge = size === 'large'
  const isCompact = size === 'compact'
  const isDark = theme === 'dark'
  const isViewportAnchored = anchor === 'viewport'

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
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Only set when the popover is portaled to document.body (see
  // tabletSheetPortal below) — click-outside detection below also has to
  // check this, since portaled content is no longer a DOM descendant of
  // containerRef even though it's still the same logical component.
  const portalRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartX = useRef(0)
  // Only used when anchor === 'viewport' — the trigger's own live
  // bounding box at the moment it was opened, which the popover is then
  // positioned from via position:fixed instead of position:absolute.
  const [viewportPos, setViewportPos] = useState<{ top: number; left: number } | null>(null)

  // Tablet-only (600px–1099px) fix for the guest availability bar
  // specifically (.hero-availability): .availability-bar has its own
  // backdrop-filter (the glass look), and Chromium treats a
  // backdrop-filter ancestor as establishing the containing block for
  // position:fixed descendants — so the CSS sheet rule in guest.css
  // (position:fixed; inset:auto 16px 16px 16px) was computing "16px from
  // the viewport edge" relative to the BAR's own box, not the true
  // viewport. Invisible on the homepage's full-viewport-height hero (the
  // bar's own bottom edge sits close enough to the true viewport bottom
  // that the difference doesn't show) but very visible on /rooms'
  // shorter masthead hero, where the 500px-tall calendar ended up
  // cut off above the viewport entirely. A portal to document.body
  // sidesteps the quirk by escaping the backdrop-filter ancestor, scoped
  // strictly to this one context and width range so desktop and mobile
  // (which still render inline, exactly as before) are untouched.
  const [isHeroTabletSheet, setIsHeroTabletSheet] = useState(false)
  useEffect(() => {
    if (!containerRef.current?.closest('.hero-availability')) return
    const mq = window.matchMedia('(min-width: 600px) and (max-width: 1099px)')
    function update() {
      setIsHeroTabletSheet(mq.matches)
    }
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      if (portalRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // A fixed position computed once at open time would drift out of
  // alignment with the trigger the moment its scrollable ancestor (e.g.
  // the admin booking detail modal) scrolls — closing on any scroll,
  // anywhere in the page (capture: true reaches scrolling inside a
  // nested container too, not just the window), is simpler and more
  // robust than tracking and repositioning on every scroll event.
  useEffect(() => {
    if (!open || !isViewportAnchored) return
    function handleScroll() {
      setOpen(false)
    }
    document.addEventListener('scroll', handleScroll, true)
    return () => document.removeEventListener('scroll', handleScroll, true)
  }, [open, isViewportAnchored])

  function openPopover() {
    if (isViewportAnchored && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const popoverWidth = isCompact ? 260 : isLarge ? 300 : 260
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - popoverWidth - 8)
      setViewportPos({ top: rect.bottom + 8, left })
    }
    setOpen(true)
  }

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
    if (
      (!allowPast && isBeforeToday(day)) ||
      isBeforeMinDate(day) ||
      isAfterMaxDate(day) ||
      isDateBlocked(day, blockedRanges)
    )
      return

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

  function isAfterMaxDate(day: Date) {
    return maxDate ? toISODate(day) > maxDate : false
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

  // Backdrop + popover as one value, rendered either inline (desktop,
  // mobile, every other caller) or — tablet only, guest bar only — via a
  // portal to document.body (see isHeroTabletSheet above for why).
  const popoverBody = (open || inline) ? (
    <>
      {open && !inline && (
        <div
          className={`popover-mobile-backdrop ${isHeroTabletSheet ? 'tablet-sheet' : ''}`}
          onClick={() => setOpen(false)}
        />
      )}
      <div
        ref={portalRef}
        className={`${inline ? 'inline-calendar relative w-full p-4' : `date-picker-popover z-20 rounded-sm border border-charcoal/10 bg-white shadow-xl ${isViewportAnchored ? 'fixed' : 'absolute mt-2'} ${isHeroTabletSheet ? 'tablet-sheet' : ''}`} ${!inline ? (
          isLarge
            ? 'w-[min(300px,calc(100vw-2rem))] p-4'
            : isCompact
              ? 'w-[260px] p-2'
              : 'w-[min(260px,calc(100vw-2rem))] p-3'
        ) : ''}`}
        style={!inline && isViewportAnchored && viewportPos ? { top: viewportPos.top, left: viewportPos.left } : undefined}
      >
        {!inline && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className={`popover-mobile-close ${isHeroTabletSheet ? 'tablet-sheet' : ''}`}
            >
              ×
            </button>
          )}
          <div
            className={`month-nav flex select-none touch-pan-y items-center justify-between ${
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
              className={`rounded-full p-1 text-charcoal/50 hover:bg-espresso/10 hover:text-espresso ${isLarge ? 'text-sm' : isCompact ? 'text-[10px]' : 'text-xs'}`}
              aria-label="Previous month"
            >
              ←
            </button>
            <p className={`month-label font-display text-charcoal ${isLarge ? 'text-sm' : isCompact ? 'text-[11px]' : 'text-xs'}`}>
              {monthLabel}
            </p>
            <button
              type="button"
              onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
              onPointerDown={(e) => e.stopPropagation()}
              className={`rounded-full p-1 text-charcoal/50 hover:bg-espresso/10 hover:text-espresso ${isLarge ? 'text-sm' : isCompact ? 'text-[10px]' : 'text-xs'}`}
              aria-label="Next month"
            >
              →
            </button>
          </div>

          <div
            className={`weekday-row mt-2 grid grid-cols-7 justify-items-center gap-y-1 text-center tracking-wide text-charcoal/40 uppercase ${
              isLarge ? 'text-[11px]' : isCompact ? 'text-[8px]' : 'text-[10px]'
            }`}
          >
            {WEEKDAY_LABELS.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>

          <div
            className={`day-grid mt-1 grid grid-cols-7 justify-items-center ${isLarge ? 'gap-y-1' : 'gap-y-0.5'}`}
          >
            {grid.map(({ date, inMonth }, i) => {
              const disabled =
                !inMonth ||
                (!allowPast && isBeforeToday(date)) ||
                isBeforeMinDate(date) ||
                isAfterMaxDate(date) ||
                isDateBlocked(date, blockedRanges)
              const isCheckIn = checkIn && isSameDay(date, checkIn)
              const isCheckOut = checkOut && isSameDay(date, checkOut)
              const isSelected = isCheckIn || isCheckOut
              const inRange =
                checkIn && checkOut && isWithinRange(date, checkIn, checkOut)
              const isToday = isSameDay(date, today)

              // Mutually exclusive branches, not combined utility classes
              // — a previous version applied e.g. both text-charcoal (the
              // enabled-day default) and text-ivory (the selected-day
              // override) to the same button at once, and whichever
              // Tailwind happened to emit last in its generated
              // stylesheet silently won. That's what produced the
              // unreadable pale-text-on-light-background selected day;
              // exactly one state's classes apply now, so there's nothing
              // left for the cascade to arbitrate.
              let stateClasses: string
              if (disabled) {
                stateClasses = 'cursor-not-allowed text-charcoal/25'
              } else if (isSelected) {
                stateClasses = 'bg-espresso text-white hover:bg-espresso'
              } else if (inRange) {
                stateClasses = 'bg-brass/20 text-charcoal hover:bg-espresso/10'
              } else {
                stateClasses = 'text-charcoal hover:bg-espresso/10'
              }

              return (
                <button
                  type="button"
                  key={i}
                  disabled={disabled}
                  onClick={() => handleDayClick(date)}
                  className={[
                    'aspect-square w-full transition-colors',
                    isLarge ? 'text-xs md:text-sm' : isCompact ? 'text-[10px]' : 'text-[11px]',
                    stateClasses,
                    // A subtle ring marks today when it isn't otherwise
                    // selected — the selected fill above always wins, and
                    // the ring never breaks the in-range band's square
                    // cells from touching seamlessly along a run of days.
                    isToday && !isSelected ? 'ring-1 ring-inset ring-espresso/50' : '',
                  ].join(' ')}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          <div
            className={`mt-2 flex items-center gap-3 border-t border-charcoal/10 pt-2 text-charcoal/50 ${
              isLarge ? 'text-[11px]' : isCompact ? 'text-[9px]' : 'text-[10px]'
            }`}
          >
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 bg-espresso" /> Selected
            </span>
            {showBookedLegend && (
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-charcoal/25" /> Booked
              </span>
            )}
          </div>
        </div>
      </>
    ) : null

  return (
    <div className="relative" ref={containerRef}>
      {!inline && (
        <button
          type="button"
          ref={triggerRef}
          onClick={() => (open ? setOpen(false) : openPopover())}
          className={`flex w-full items-center gap-2 text-left focus:outline-none ${
            bare
              ? ''
              : `rounded-sm border ${
                  isDark ? 'border-ivory/40 focus:border-brass' : 'border-charcoal/20 focus:border-espresso'
                } ${isLarge ? 'px-6 py-5 text-base' : 'px-4 py-3 text-sm'}`
          }`}
        >
          <Calendar
            size={isLarge ? 16 : 14}
            className={`shrink-0 ${isDark ? 'text-brass' : 'text-espresso'}`}
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
      )}

      {isHeroTabletSheet && open && !inline
        ? createPortal(popoverBody, document.body)
        : popoverBody}
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
