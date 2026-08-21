'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import DateRangePicker from '@/components/DateRangePicker'

export default function RoomsFilterBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(checkIn: string | null, checkOut: string | null) {
    const next = new URLSearchParams(searchParams.toString())
    if (checkIn) {
      next.set('checkin', checkIn)
    } else {
      next.delete('checkin')
    }
    if (checkOut) {
      next.set('checkout', checkOut)
    } else {
      next.delete('checkout')
    }
    router.push(next.size > 0 ? `${pathname}?${next.toString()}` : pathname)
  }

  const hasDates = Boolean(searchParams.get('checkin') && searchParams.get('checkout'))

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
          initialCheckIn={searchParams.get('checkin')}
          initialCheckOut={searchParams.get('checkout')}
          onChange={handleChange}
          size="large"
        />
      </div>
    </div>
  )
}
