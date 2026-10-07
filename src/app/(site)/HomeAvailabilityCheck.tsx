'use client'

import { useState } from 'react'
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
}: {
  // Only passed on /rooms, where dates may already be in the URL from a
  // previous search — the homepage never has any, so it omits these.
  initialCheckIn?: string | null
  initialCheckOut?: string | null
  variant?: 'bar' | 'calendar'
} = {}) {
  const router = useRouter()
  const [checkIn, setCheckIn] = useState<string | null>(initialCheckIn)
  const [checkOut, setCheckOut] = useState<string | null>(initialCheckOut)
  const [guests, setGuests] = useState<GuestCounts>({ adults: 1, children: 0 })
  const [error, setError] = useState('')

  function handleCheckAvailability() {
    if (!checkIn || !checkOut) {
      setError('Please select your check-in and check-out dates.')
      return
    }
    if (checkOut <= checkIn) {
      setError('Check-out must be after check-in.')
      return
    }
    // Same ?checkin=&checkout= param names the rooms listing page's own
    // date filter already reads, so landing there shows availability
    // immediately instead of asking the guest to pick dates again.
    const params = new URLSearchParams({
      checkin: checkIn,
      checkout: checkOut,
      adults: String(guests.adults),
      children: String(guests.children),
    })
    router.push(`/rooms?${params.toString()}`)
  }

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
      {/* Check-in/Check-out share a row on mobile (grid-cols-2); Guests and
          the button each get their own full-width row below (col-span-2 —
          harmless once `sm:flex` swaps the parent to flex display, so it
          has no effect from `sm:` up). Giving the button the full card
          width on mobile, rather than half a row shared with Guests, is
          what keeps its label on one line instead of wrapping. */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:flex sm:flex-row sm:items-stretch sm:gap-0 sm:divide-x sm:divide-charcoal/10">
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

        <div className="col-span-2 px-3 py-3 sm:flex-1 sm:px-5 sm:py-2">
          <p className="text-[10px] tracking-widest text-stone uppercase">
            Guests
          </p>
          <div className="mt-1">
            <GuestPicker value={guests} onChange={setGuests} />
          </div>
        </div>

        <div className="col-span-2 flex items-center px-3 py-3 sm:px-5 sm:py-2">
          <button
            type="button"
            onClick={handleCheckAvailability}
            className="w-full rounded-full border border-brass px-4 py-3 text-xs tracking-widest text-charcoal uppercase transition-colors duration-base hover:bg-brass/10 sm:w-auto sm:px-6 sm:tracking-[0.2em]"
          >
            Check Availability
          </button>
        </div>
      </div>
      {error && <p className="px-3 pb-1 text-sm text-clay sm:px-5">{error}</p>}
    </div>
  )
}
