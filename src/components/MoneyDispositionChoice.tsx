'use client'

import Dropdown from './Dropdown'

export type MoneyDisposition = 'hold_credit' | 'refund' | 'keep'

const DISPOSITION_OPTIONS: { value: MoneyDisposition; label: string; hint: string }[] = [
  {
    value: 'hold_credit',
    label: 'Hold as credit',
    hint: "Added to the guest's credit balance for a future booking.",
  },
  {
    value: 'refund',
    label: 'Refund',
    hint: 'You pay it back manually — this just records that you did.',
  },
  {
    value: 'keep',
    label: 'Keep (no refund)',
    hint: 'The amount stays with the hotel.',
  },
]

const REFUND_METHOD_OPTIONS = [
  { value: 'transfer' as const, label: 'Transfer' },
  { value: 'pos' as const, label: 'POS' },
]

/**
 * What happens to an amount already paid, when it's no longer owed to
 * the hotel for the stay it was paid against — shared by
 * cancelBookingByStaff (cancelling a booking that's already been paid)
 * and earlyCheckout (an overpayment from shortening a stay), both of
 * which call the exact same server-side logic
 * (applyMoneyDispositionForAmount in src/app/admin/bookings/actions.ts).
 * One component here keeps the choice presented identically in both
 * places, per the brief's own "reuse the same component and logic".
 */
export default function MoneyDispositionChoice({
  amount,
  disposition,
  onDispositionChange,
  refundMethod,
  onRefundMethodChange,
  note,
  onNoteChange,
}: {
  amount: number
  disposition: MoneyDisposition
  onDispositionChange: (value: MoneyDisposition) => void
  refundMethod: 'transfer' | 'pos'
  onRefundMethodChange: (value: 'transfer' | 'pos') => void
  note: string
  onNoteChange: (value: string) => void
}) {
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs tracking-widest text-charcoal/60 uppercase">
        What happens to the ₦{amount.toLocaleString()} already paid?
      </p>
      <div className="space-y-1.5">
        {DISPOSITION_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-start gap-2.5 rounded-sm border px-3 py-2 text-sm transition-colors ${
              disposition === opt.value
                ? 'border-espresso bg-espresso/5'
                : 'border-charcoal/15 hover:border-charcoal/30'
            }`}
          >
            <input
              type="radio"
              name="money-disposition"
              className="mt-0.5"
              checked={disposition === opt.value}
              onChange={() => onDispositionChange(opt.value)}
            />
            <span>
              <span className="block text-charcoal">{opt.label}</span>
              <span className="block text-xs text-charcoal/50">{opt.hint}</span>
            </span>
          </label>
        ))}
      </div>

      {disposition === 'refund' && (
        <div>
          <label className="block text-xs tracking-widest text-charcoal/60 uppercase">
            Refund method
          </label>
          <div className="mt-1">
            <Dropdown value={refundMethod} options={REFUND_METHOD_OPTIONS} onChange={onRefundMethodChange} />
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs tracking-widest text-charcoal/60 uppercase">Note</label>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={2}
          className="mt-1 w-full resize-none rounded-sm border border-charcoal/20 px-2 py-1.5 text-sm text-charcoal"
        />
      </div>
    </div>
  )
}
