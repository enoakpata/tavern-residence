'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createManualBooking, getAvailableRooms } from '../actions'
import type { Room } from '@/lib/types'

export default function NewBookingForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [source, setSource] = useState<'walk_in' | 'phone'>('walk_in')
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'transfer'>('card')

  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [rooms, setRooms] = useState<(Room & { available: boolean })[]>([])
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [roomId, setRoomId] = useState('')

  const hasDates = Boolean(checkIn && checkOut)

  useEffect(() => {
    if (!checkIn || !checkOut) {
      return
    }

    let cancelled = false

    async function fetchAvailability() {
      setLoadingRooms(true)
      const result = await getAvailableRooms(checkIn, checkOut)
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
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="text-xs tracking-widest text-charcoal/60 uppercase">
            Check-in
          </label>
          <input
            type="date"
            name="check_in"
            required
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="mt-2 w-full rounded-sm border border-charcoal/20 px-4 py-3 text-sm focus:border-verdant focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs tracking-widest text-charcoal/60 uppercase">
            Check-out
          </label>
          <input
            type="date"
            name="check_out"
            required
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className="mt-2 w-full rounded-sm border border-charcoal/20 px-4 py-3 text-sm focus:border-verdant focus:outline-none"
          />
        </div>
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
        <select
          name="room_id"
          required
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          disabled={!hasDates || loadingRooms}
          className="mt-2 w-full rounded-sm border border-charcoal/20 px-4 py-3 text-sm focus:border-verdant focus:outline-none disabled:opacity-50"
        >
          <option value="">
            {!hasDates
              ? 'Select check-in and check-out dates first'
              : loadingRooms
                ? 'Checking availability…'
                : 'Select a room'}
          </option>
          {visibleRooms.map((room) => (
            <option key={room.id} value={room.id} disabled={!room.available}>
              {room.room_number} — {room.name} (₦
              {room.price_per_night.toLocaleString()}/night)
              {!room.available ? ' — Unavailable for these dates' : ''}
            </option>
          ))}
        </select>
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
          defaultValue={paymentMethod === 'card' ? 'paid' : 'awaiting_verification'}
          className="mt-2 w-full rounded-sm border border-charcoal/20 px-4 py-3 text-sm focus:border-verdant focus:outline-none"
        >
          <option value="paid">Paid</option>
          <option value="awaiting_verification">Awaiting verification (transfer)</option>
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
