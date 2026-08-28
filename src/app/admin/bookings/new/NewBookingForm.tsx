'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createManualBooking, getAvailableRooms } from '../actions'
import DateRangePicker from '@/components/DateRangePicker'
import RoomSelect from '@/components/RoomSelect'
import type { Room } from '@/lib/types'

export default function NewBookingForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [source, setSource] = useState<'walk_in' | 'phone'>('walk_in')
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'transfer'>('card')

  const [checkIn, setCheckIn] = useState<string | null>(null)
  const [checkOut, setCheckOut] = useState<string | null>(null)
  const [rooms, setRooms] = useState<(Room & { available: boolean })[]>([])
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [roomId, setRoomId] = useState('')

  const hasDates = Boolean(checkIn && checkOut)

  useEffect(() => {
    if (!checkIn || !checkOut) {
      return
    }
    const currentCheckIn = checkIn
    const currentCheckOut = checkOut

    let cancelled = false

    async function fetchAvailability() {
      setLoadingRooms(true)
      const result = await getAvailableRooms(currentCheckIn, currentCheckOut)
      if (cancelled) return
      setRooms(result)
      setLoadingRooms(false)
      setRoomId((prev) =>
        result.some((room) => room.id === prev && room.available) ? prev : ''
      )
    }

    fetchAvailability()

    return () => {
      cancelled = true
    }
  }, [checkIn, checkOut])

  const visibleRooms = hasDates ? rooms : []

  function handleSubmit(formData: FormData) {
    setError('')
    startTransition(async () => {
      const res = await createManualBooking(formData)
      if (res.success) {
        router.push('/admin/bookings')
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <form action={handleSubmit} className="max-w-xl space-y-5">
      <div>
        <label className="text-xs tracking-widest text-charcoal/60 uppercase">
          Dates
        </label>
        <div className="mt-2">
          <DateRangePicker
            blockedRanges={[]}
            onChange={(newCheckIn, newCheckOut) => {
              setCheckIn(newCheckIn)
              setCheckOut(newCheckOut)
            }}
          />
        </div>
        <input type="hidden" name="check_in" value={checkIn ?? ''} />
        <input type="hidden" name="check_out" value={checkOut ?? ''} />
      </div>

      <div>
        <label className="text-xs tracking-widest text-charcoal/60 uppercase">
          Booking source
        </label>
        <div className="mt-2 flex gap-4">
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-sm border border-charcoal/20 px-4 py-3 text-sm has-checked:border-verdant has-checked:bg-verdant/5">
            <input
              type="radio"
              name="source"
              value="walk_in"
              checked={source === 'walk_in'}
              onChange={() => setSource('walk_in')}
            />
            Walk-in
          </label>
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-sm border border-charcoal/20 px-4 py-3 text-sm has-checked:border-verdant has-checked:bg-verdant/5">
            <input
              type="radio"
              name="source"
              value="phone"
              checked={source === 'phone'}
              onChange={() => setSource('phone')}
            />
            Phone
          </label>
        </div>
      </div>

      <div>
        <label className="text-xs tracking-widest text-charcoal/60 uppercase">
          Room
        </label>
        <div className="mt-2">
          <RoomSelect
            rooms={visibleRooms}
            value={roomId}
            onChange={setRoomId}
            disabled={!hasDates || loadingRooms}
            placeholder={
              !hasDates
                ? 'Select check-in and check-out dates first'
                : loadingRooms
                  ? 'Checking availability…'
                  : 'Select a room'
            }
          />
        </div>
        <input type="hidden" name="room_id" value={roomId} />
      </div>

      <div>
        <label className="text-xs tracking-widest text-charcoal/60 uppercase">
          Guest name
        </label>
        <input
          type="text"
          name="guest_name"
          required
          className="mt-2 w-full rounded-sm border border-charcoal/20 px-4 py-3 text-sm focus:border-verdant focus:outline-none"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="text-xs tracking-widest text-charcoal/60 uppercase">
            Phone
          </label>
          <input
            type="tel"
            name="guest_phone"
            required
            className="mt-2 w-full rounded-sm border border-charcoal/20 px-4 py-3 text-sm focus:border-verdant focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs tracking-widest text-charcoal/60 uppercase">
            Email (optional)
          </label>
          <input
            type="email"
            name="guest_email"
            className="mt-2 w-full rounded-sm border border-charcoal/20 px-4 py-3 text-sm focus:border-verdant focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="text-xs tracking-widest text-charcoal/60 uppercase">
          Payment method
        </label>
        <div className="mt-2 flex gap-4">
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-sm border border-charcoal/20 px-4 py-3 text-sm has-checked:border-verdant has-checked:bg-verdant/5">
            <input
              type="radio"
              name="payment_method"
              value="card"
              checked={paymentMethod === 'card'}
              onChange={() => setPaymentMethod('card')}
            />
            Card (POS)
          </label>
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-sm border border-charcoal/20 px-4 py-3 text-sm has-checked:border-verdant has-checked:bg-verdant/5">
            <input
              type="radio"
              name="payment_method"
              value="transfer"
              checked={paymentMethod === 'transfer'}
              onChange={() => setPaymentMethod('transfer')}
            />
            Bank transfer
          </label>
        </div>
      </div>

      <div>
        <label className="text-xs tracking-widest text-charcoal/60 uppercase">
          Payment status
        </label>
        <select
          name="payment_status"
          defaultValue={paymentMethod === 'card' ? 'paid' : 'unpaid'}
          className="mt-2 w-full rounded-sm border border-charcoal/20 px-4 py-3 text-sm focus:border-verdant focus:outline-none"
        >
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
      </div>

      {error && <p className="text-sm text-clay">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-sm bg-verdant py-4 text-sm tracking-widest text-ivory uppercase transition-colors hover:bg-verdant/90 disabled:opacity-50"
      >
        {isPending ? 'Creating booking…' : 'Create booking'}
      </button>
    </form>
  )
}
