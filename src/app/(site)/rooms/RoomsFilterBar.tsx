'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import DateRangePicker from '@/components/DateRangePicker'
import { todayInLagos } from '@/lib/dateUtils'

export default function RoomsFilterBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(checkIn: string | null, checkOut: string | null) {
    // DateRangePicker's onChange fires once after picking check-in alone
    // (checkOut still null) and again once the range is complete — only
    // push a URL update on the latter, so picking dates triggers a single
    // refetch instead of one after each individual click.
    if (!checkIn || !checkOut) return

    const next = new URLSearchParams(searchParams.toString())
    next.set('checkin', checkIn)
    next.set('checkout', checkOut)
    router.push(`${pathname}?${next.toString()}`)
  }

  // A bookmarked/shared link or an old tab left open can carry a checkin
  // that's since passed — checked against the hotel's own Lagos "today",
  // not the visitor's device clock. A stale value is treated the same as
  // no dates at all, both for the picker's own initial selection below and
  // for this "any dates selected" flag.
  const rawCheckIn = searchParams.get('checkin')
  const rawCheckOut = searchParams.get('checkout')
  const datesAreStale = Boolean(rawCheckIn && rawCheckIn < todayInLagos())
  const validCheckIn = datesAreStale ? null : rawCheckIn
  const validCheckOut = datesAreStale ? null : rawCheckOut
  const hasDates = Boolean(validCheckIn && validCheckOut)

  return (
    <div className="mt-8 max-w-sm">
      {!hasDates && (
        <p className="mb-4 border-l-4 border-brass bg-verdant/5 px-4 py-3 text-sm text-verdant">
          Select your dates to see what&apos;s available
        </p>
      )}
      <label className="text-xs tracking-widest text-charcoal/60 uppercase">
        Check availability
      </label>
      <div className="mt-2">
        <DateRangePicker
          blockedRanges={[]}
          initialCheckIn={validCheckIn}
          initialCheckOut={validCheckOut}
          onChange={handleChange}
          size="large"
        />
      </div>
    </div>
  )
}
