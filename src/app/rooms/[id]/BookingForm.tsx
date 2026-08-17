'use client'

import { useState, useTransition } from 'react'
import { createBooking } from './actions'
import type { Room } from '@/lib/types'

export default function BookingForm({ room }: { room: Room }) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<
    { success: true; bookingId: string } | { success: false; error: string } | null
  >(null)

  function handleSubmit(formData: FormData) {
    setResult(null)
    startTransition(async () => {
      const res = await createBooking(formData)
      setResult(res)
    })
  }

  if (result?.success) {
    return (
      <div className="rounded-sm border border-verdant/20 bg-verdant/5 p-6">
        <p className="font-display text-xl text-verdant">Request received</p>
        <p className="mt-2 text-sm text-charcoal/70">
          We&apos;ve received your booking request. We&apos;ll confirm with you
          shortly by phone or WhatsApp. Your booking reference is{' '}
          <span className="font-medium text-charcoal">
            {result.bookingId.slice(0, 8)}
          </span>
          .
        </p>
      </div>
    )
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <input type="hidden" name="room_id" value={room.id} />

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="text-xs tracking-widest text-charcoal/60 uppercase">
            Check-in
          </label>
          <input
            type="date"
            name="check_in"
            required
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
            className="mt-2 w-full rounded-sm border border-charcoal/20 px-4 py-3 text-sm focus:border-verdant focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="text-xs tracking-widest text-charcoal/60 uppercase">
          Full name
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
            Phone / WhatsApp
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
            <input type="radio" name="payment_method" value="card" defaultChecked />
            Card
          </label>
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-sm border border-charcoal/20 px-4 py-3 text-sm has-checked:border-verdant has-checked:bg-verdant/5">
            <input type="radio" name="payment_method" value="transfer" />
            Bank transfer
          </label>
        </div>
      </div>

      {result && !result.success && (
        <p className="text-sm text-clay">{result.error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-sm bg-verdant py-4 text-sm tracking-widest text-ivory uppercase transition-colors hover:bg-verdant/90 disabled:opacity-50"
      >
        {isPending ? 'Checking availability…' : `Request to book — ₦${room.price_per_night.toLocaleString()}/night`}
      </button>

      <p className="text-xs text-charcoal/50">
        Free cancellation up to 24 hours before check-in. Cancellations
        within 24 hours or no-shows are charged 50% of the booking value.
      </p>
    </form>
  )
}
