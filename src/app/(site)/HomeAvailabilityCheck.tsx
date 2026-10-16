'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import DateRangePicker from '@/components/DateRangePicker'
import GuestPicker, { type GuestCounts } from './GuestPicker'
import { parseISODate, toISODate } from '@/lib/dateUtils'

// The day after a given ISO date — same small helper already duplicated
// per-file elsewhere (BookingActions.tsx, NewBookingForm.tsx) rather than
// a shared util, matching that existing convention.
function dayAfter(iso: string): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + 1)
  return toISODate(d)
}

// Set right before navigating (see submitAvailability) when
// scrollToRoomsOnComplete is on, read back once by the freshly-mounted
// instance this navigation lands on (the initialCheckIn/initialCheckOut
// change gives this component a new React `key` in PageHero.tsx, so it's
// a brand new instance, not the one that set the marker — sessionStorage
// is what survives that remount). Its mere presence means "this mount
// was caused by a guest just submitting dates here, not a fresh page
// load" — consumed (removed) the moment it's read, so a real reload or a
// shared link with dates already in the URL never scrolls.
const SCROLL_MARKER_KEY = 'tr-scroll-to-rooms'
// Covers the calendar popover closing and gives the newly-landed page a
// moment to settle before the viewport moves, without being so long it
// reads as sluggish.
const SCROLL_DELAY_MS = 200

function scrollToRoomsList() {
  const target = document.getElementById('rooms')
  if (!target) return
  const rect = target.getBoundingClientRect()
  // Any part of the list already on screen — leave the scroll position
  // alone rather than yanking it back up to a "perfect" alignment.
  if (rect.top < window.innerHeight && rect.bottom > 0) return

  const header = document.querySelector('.guest-header')
  const headerHeight = header ? header.getBoundingClientRect().height : 0
  const targetY = Math.max(0, window.scrollY + rect.top - headerHeight - 16)
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: targetY, behavior: reduceMotion ? 'auto' : 'smooth' })
}

// The homepage uses the inline calendar; the rooms page keeps the compact
// booking bar. Both presentations share the same availability navigation.
//
// Guests is a real, working selector (adults/children are carried through
// to /rooms as ?adults=&children=), but nothing on /rooms currently
// filters by it — there's no guest-count concept in the availability
// query yet. Wiring that up would be a booking-logic change, not a visual
// one, so it's left as a param for now rather than pretending to filter
// results it doesn't.
export default function HomeAvailabilityCheck({
  initialCheckIn = null,
  initialCheckOut = null,
  variant = 'bar',
  scrollToRoomsOnComplete = false,
}: {
  // Only passed on /rooms, where dates may already be in the URL from a
  // previous search — the homepage never has any, so it omits these.
  initialCheckIn?: string | null
  initialCheckOut?: string | null
  variant?: 'bar' | 'calendar'
  // /rooms only (see rooms/page.tsx) — once on, finishing a date range
  // here submits immediately (same as clicking Check Availability) and,
  // once the refreshed room list lands, scrolls it into view. The
  // homepage never passes this, so its bar's behavior — click the button,
  // get taken to /rooms, nothing scrolls on the page you're leaving — is
  // completely unchanged.
  scrollToRoomsOnComplete?: boolean
} = {}) {
  const router = useRouter()
  const [checkIn, setCheckIn] = useState<string | null>(initialCheckIn)
  const [checkOut, setCheckOut] = useState<string | null>(initialCheckOut)
  const [guests, setGuests] = useState<GuestCounts>({ adults: 1, children: 0 })
  const [error, setError] = useState('')

  // Consume the marker (if any) left by the submit that caused this very
  // mount — see SCROLL_MARKER_KEY above. Runs once per mount, which is
  // exactly what's needed: a genuine first load (even with dates already
  // in the URL) never finds a marker, so it never scrolls.
  useEffect(() => {
    if (!scrollToRoomsOnComplete) return
    let hasMarker = false
    try {
      hasMarker = sessionStorage.getItem(SCROLL_MARKER_KEY) === '1'
    } catch {
      // Storage unavailable (private mode, disabled, etc.) — just skip
      // the scroll rather than letting it throw.
    }
    if (!hasMarker) return
    // Only consumed once the timer actually fires, not the moment it's
    // read — React 18 Strict Mode runs this effect, its cleanup, and then
    // the effect again on mount (dev only); removing the marker here
    // immediately would make the first pass eat it and the second
    // (surviving) pass find nothing. Clearing the first pass's timer in
    // its cleanup before the marker is ever touched means only the timer
    // that actually survives gets to consume it and scroll.
    const timer = setTimeout(() => {
      try {
        sessionStorage.removeItem(SCROLL_MARKER_KEY)
      } catch {
        // Already unavailable, same as above — nothing more to clean up.
      }
      scrollToRoomsList()
    }, SCROLL_DELAY_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function submitAvailability(nextCheckIn: string, nextCheckOut: string) {
    // Same ?checkin=&checkout= param names the rooms listing page's own
    // date filter already reads, so landing there shows availability
    // immediately instead of asking the guest to pick dates again.
    const params = new URLSearchParams({
      checkin: nextCheckIn,
      checkout: nextCheckOut,
      adults: String(guests.adults),
      children: String(guests.children),
    })
    if (scrollToRoomsOnComplete) {
      try {
        sessionStorage.setItem(SCROLL_MARKER_KEY, '1')
      } catch {
        // Nothing to scroll to without it — the submit itself still works.
      }
    }
    router.push(`/rooms?${params.toString()}`)
  }

  function handleCheckAvailability() {
    if (!checkIn || !checkOut) {
      setError('Please select your check-in and check-out dates.')
      return
    }
    if (checkOut <= checkIn) {
      setError('Check-out must be after check-in.')
      return
    }
    submitAvailability(checkIn, checkOut)
  }

  // /rooms only: the instant a full, valid range is picked in the bar —
  // not on mount (even with both dates already seeded from the URL), and
  // not every time this fires on a change that isn't actually a fresh
  // completion (e.g. re-picking check-out within an already-complete
  // range) — submit right away, same as clicking the button. didMountRef
  // skips the mount run; prevCompleteRef tracks the last known
  // complete/incomplete state so this only fires on the incomplete ->
  // complete transition, not on every keystroke-equivalent update.
  const didMountRef = useRef(false)
  const prevCompleteRef = useRef(Boolean(checkIn && checkOut && checkOut > checkIn))
  useEffect(() => {
    const isComplete = Boolean(checkIn && checkOut && checkOut > checkIn)
    if (scrollToRoomsOnComplete && didMountRef.current && isComplete && !prevCompleteRef.current) {
      submitAvailability(checkIn as string, checkOut as string)
    }
    didMountRef.current = true
    prevCompleteRef.current = isComplete
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn, checkOut])

  if (variant === 'calendar') {
    return (
      <div className="availability-calendar">
        <DateRangePicker
          blockedRanges={[]}
          initialCheckIn={initialCheckIn}
          initialCheckOut={initialCheckOut}
          onChange={(newCheckIn, newCheckOut) => {
            setCheckIn(newCheckIn)
            setCheckOut(newCheckOut)
            setError('')
          }}
          inline
          size="large"
        />
        <div className="calendar-guest-row">
          <span>Guests</span>
          <GuestPicker value={guests} onChange={setGuests} />
        </div>
        <button type="button" onClick={handleCheckAvailability} className="calendar-submit">
          Check availability <ArrowUpRight size={17} aria-hidden="true" />
        </button>
        {error && <p role="alert" className="calendar-error">{error}</p>}
      </div>
    )
  }

  return (
    <div className="availability-bar mx-auto w-full max-w-5xl rounded-sm bg-white p-4 sm:p-3">
      {/* Every field stacks full-width on mobile (grid-cols-1) — a narrow
          half-width Check-in/Check-out column used to force "Select
          dates"/"Select check-out" onto two lines. `sm:flex` swaps to the
          horizontal divided layout from the sm: breakpoint up. */}
      <div className="grid grid-cols-1 gap-y-3 sm:flex sm:flex-row sm:items-stretch sm:gap-0 sm:divide-x sm:divide-charcoal/10">
        <div className="px-3 py-3 sm:flex-1 sm:px-5 sm:py-2">
          <p className="text-[10px] tracking-widest text-stone uppercase">
            Check-in
          </p>
          <div className="mt-1">
            <DateRangePicker
              mode="single"
              blockedRanges={[]}
              initialCheckIn={initialCheckIn}
              onChange={(newCheckIn) => {
                setCheckIn(newCheckIn)
                // A check-out already picked that's no longer after the
                // new check-in can't stay selected.
                if (newCheckIn && checkOut && checkOut <= newCheckIn) {
                  setCheckOut(null)
                }
                setError('')
              }}
              bare
            />
          </div>
        </div>

        <div className="px-3 py-3 sm:flex-1 sm:px-5 sm:py-2">
          <p className="text-[10px] tracking-widest text-stone uppercase">
            Check-out
          </p>
          <div className="mt-1">
            <DateRangePicker
              mode="single"
              blockedRanges={[]}
              initialCheckIn={initialCheckOut}
              minDate={checkIn ? dayAfter(checkIn) : null}
              onChange={(newCheckOut) => {
                setCheckOut(newCheckOut)
                setError('')
              }}
              bare
            />
          </div>
        </div>

        <div className="px-3 py-3 sm:flex-1 sm:px-5 sm:py-2">
          <p className="text-[10px] tracking-widest text-stone uppercase">
            Guests
          </p>
          <div className="mt-1">
            <GuestPicker value={guests} onChange={setGuests} />
          </div>
        </div>

        <div className="flex items-center px-3 py-3 sm:px-5 sm:py-2">
          <button
            type="button"
            onClick={handleCheckAvailability}
            className="availability-submit w-full sm:w-auto"
          >
            Check Availability
          </button>
        </div>
      </div>
      {error && <p className="px-3 pb-1 text-sm text-clay sm:px-5">{error}</p>}
    </div>
  )
}
