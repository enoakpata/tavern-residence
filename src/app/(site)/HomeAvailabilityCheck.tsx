'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DateRangePicker from '@/components/DateRangePicker'

export default function HomeAvailabilityCheck() {
  const router = useRouter()
  const [checkIn, setCheckIn] = useState<string | null>(null)
  const [checkOut, setCheckOut] = useState<string | null>(null)
  const [error, setError] = useState('')

  function handleCheckAvailability() {
    if (!checkIn || !checkOut) {
      setError('Please select your check-in and check-out dates.')
      return
    }
    // Same ?checkin=&checkout= param names the rooms listing page's own
    // date filter already reads, so landing there shows availability
    // immediately instead of asking the guest to pick dates again.
    const params = new URLSearchParams({ checkin: checkIn, checkout: checkOut })
    router.push(`/rooms?${params.toString()}`)
  }

  return (
    <div className="max-w-sm md:max-w-[520px]">      
    <DateRangePicker
      blockedRanges={[]}
      onChange={(newCheckIn, newCheckOut) => {
        setCheckIn(newCheckIn)
        setCheckOut(newCheckOut)
        if (newCheckIn && newCheckOut) setError('')
      }}
      size="large"
      theme="dark"
    />
      <button
        type="button"
        onClick={handleCheckAvailability}
        className="mt-4 w-64 rounded-full bg-brass px-8 py-4 text-sm tracking-widest text-verdant uppercase transition-opacity hover:opacity-90"      >
        Check availability
      </button>
      {error && <p className="mt-3 text-sm text-clay">{error}</p>}
    </div>
  )
}
