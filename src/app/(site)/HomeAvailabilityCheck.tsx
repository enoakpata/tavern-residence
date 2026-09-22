'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

// The floating white booking bar overlapping the hero's bottom edge (see
// the -mt-* wrapper around this in page.tsx). A 2x2 grid below `sm`
// (Check-in/Check-out on one row, Guests/button on the next) rather than
// stacking all 4 items in one vertical column — kept deliberately short
// even on narrow screens, since the whole point of the wrapper's
// negative margin is to keep this bar from extending past the hero photo
// behind it, and a 4-row stack would make that essentially unachievable
// on a phone-height viewport. From `sm:` up it's a single hairline-
// divided row. Check-in/check-out reuse DateRangePicker in `mode="single"`
// (bare, so it renders as plain text + its own calendar icon with no
// border) — two fields, still the one shared date-picker component and
// its existing validation doing the work.
//
// Guests is a real, working selector (adults/children are carried through
// to /rooms as ?adults=&children=), but nothing on /rooms currently
// filters by it — there's no guest-count concept in the availability
// query yet. Wiring that up would be a booking-logic change, not a visual
// one, so it's left as a param for now rather than pretending to filter
// results it doesn't.
export default function HomeAvailabilityCheck() {
  const router = useRouter()
  const [checkIn, setCheckIn] = useState<string | null>(null)
  const [checkOut, setCheckOut] = useState<string | null>(null)
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

  return (
    <div className="mx-auto w-full max-w-5xl rounded-sm bg-white p-2 shadow-2xl sm:p-3">
      <div className="grid grid-cols-2 gap-x-2 gap-y-2 sm:flex sm:flex-row sm:items-stretch sm:gap-0 sm:divide-x sm:divide-charcoal/10">
        <div className="px-2 py-2 sm:flex-1 sm:px-5">
          <p className="text-[10px] tracking-widest text-stone uppercase">
            Check-in
          </p>
          <div className="mt-1">
            <DateRangePicker
              mode="single"
              blockedRanges={[]}
              initialCheckIn={checkIn}
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

        <div className="px-2 py-2 sm:flex-1 sm:px-5">
          <p className="text-[10px] tracking-widest text-stone uppercase">
            Check-out
          </p>
          <div className="mt-1">
            <DateRangePicker
              mode="single"
              blockedRanges={[]}
              initialCheckIn={checkOut}
              minDate={checkIn ? dayAfter(checkIn) : null}
              onChange={(newCheckOut) => {
                setCheckOut(newCheckOut)
                setError('')
              }}
              bare
            />
          </div>
        </div>

        <div className="px-2 py-2 sm:flex-1 sm:px-5">
          <p className="text-[10px] tracking-widest text-stone uppercase">
            Guests
          </p>
          <div className="mt-1">
            <GuestPicker value={guests} onChange={setGuests} />
          </div>
        </div>

        <div className="flex items-center px-2 py-2 sm:px-5">
          <button
            type="button"
            onClick={handleCheckAvailability}
            className="w-full rounded-full border border-brass px-6 py-3 text-xs tracking-[0.2em] text-charcoal uppercase transition-colors duration-base hover:bg-brass/10 sm:w-auto"
          >
            Check Availability
          </button>
        </div>
      </div>
      {error && <p className="px-2 pb-1 text-sm text-clay sm:px-5">{error}</p>}
    </div>
  )
}
