'use client'

import { useState, useTransition } from 'react'
import {
  markAsPaid,
  chargeFullStay,
  chargeNoShowFee,
  updateBookingStatus,
} from './actions'

type BookingActionsProps = {
  bookingId: string
  status: string
  paymentMethod: string
  paymentStatus: string
  paymentToken: string | null
  guestEmail: string | null
  totalAmount: number
}

const STATUS_OPTIONS = [
  'pending',
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled',
  'no_show',
]

export default function BookingActions({
  bookingId,
  status,
  paymentMethod,
  paymentStatus,
  paymentToken,
  guestEmail,
  totalAmount,
}: BookingActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError('')
    startTransition(async () => {
      const res = await action()
      if (!res.success) setError(res.error ?? 'Something went wrong.')
    })
  }

  const canChargeCard =
    paymentMethod === 'card' && paymentToken && paymentStatus !== 'paid' && guestEmail

  return (
    <div className="flex flex-wrap items-center gap-2">
      {paymentMethod === 'transfer' && paymentStatus === 'awaiting_verification' && (
        <button
          disabled={isPending}
          onClick={() =>
            run(() => markAsPaid(bookingId))
          }
          className="rounded-full bg-verdant/10 px-3 py-1 text-xs text-verdant hover:bg-verdant/20 disabled:opacity-50"
        >
          Mark as paid
        </button>
      )}

      {canChargeCard && (
        <button
          disabled={isPending}
          onClick={() => {
            if (!confirm(`Charge full stay (₦${totalAmount.toLocaleString()}) to this guest's saved card?`)) return
            run(() =>
              chargeFullStay(bookingId, paymentToken!, totalAmount, guestEmail!)
            )
          }}
          className="rounded-full bg-verdant px-3 py-1 text-xs text-ivory hover:bg-verdant/90 disabled:opacity-50"
        >
          Charge full stay
        </button>
      )}

      {canChargeCard && (
        <button
          disabled={isPending}
          onClick={() => {
            const fee = Math.round(totalAmount * 0.5)
            if (!confirm(`Charge 50% no-show/late-cancellation fee (₦${fee.toLocaleString()}) to this guest's saved card?`)) return
            run(() =>
              chargeNoShowFee(bookingId, paymentToken!, totalAmount, guestEmail!)
            )
          }}
          className="rounded-full bg-clay/10 px-3 py-1 text-xs text-clay hover:bg-clay/20 disabled:opacity-50"
        >
          Charge no-show fee
        </button>
      )}

      <select
        value={status}
        disabled={isPending}
        onChange={(e) => run(() => updateBookingStatus(bookingId, e.target.value))}
        className="rounded-full border border-charcoal/20 bg-white px-2 py-1 text-xs text-charcoal disabled:opacity-50"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s.replace('_', ' ')}
          </option>
        ))}
      </select>

      {error && <p className="w-full text-xs text-clay">{error}</p>}
    </div>
  )
}
