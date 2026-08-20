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

  return (
    <div className="mt-8 max-w-xs">
      <label className="text-xs tracking-widest text-charcoal/60 uppercase">
        Check availability
      </label>
      <div className="mt-2">
        <DateRangePicker
          blockedRanges={[]}
          initialCheckIn={searchParams.get('checkin')}
          initialCheckOut={searchParams.get('checkout')}
          onChange={handleChange}
        />
      </div>
    </div>
  )
}
