'use client'

import { useEffect, useState, useTransition } from 'react'
import { recordPayment, voidPayment, getBookingPayments } from './actions'
import ConfirmModal from '@/components/ConfirmModal'
import DateRangePicker from '@/components/DateRangePicker'
import MoneyInput from '@/components/MoneyInput'
import Dropdown, { type DropdownOption } from '@/components/Dropdown'
import { overpaidAmount } from '@/lib/bookingStatus'
import { formatLagosDateTime, todayInLagos } from '@/lib/dateUtils'
import { PAYMENT_STYLES } from '@/lib/statusStyles'
import type { BookingPayment, BookingPaymentMethod } from '@/lib/types'

// Only these two are offered now — see recordPayment's own
// RECORDABLE_METHODS in actions.ts, which enforces the same restriction
// server-side. Historical rows (cash/card/other) still display fine in
// the History table below; this only limits what a NEW entry can use.
const PAYMENT_METHOD_OPTIONS: DropdownOption<BookingPaymentMethod>[] = [
  { value: 'transfer', label: 'Transfer' },
  { value: 'pos', label: 'POS' },
]

export default function PaymentsSection({
  bookingId,
  totalAmount,
  amountPaid,
  paymentStatus,
  locked,
  onActionComplete,
}: {
  bookingId: string
  totalAmount: number | null
  amountPaid: number
  paymentStatus: string
  // Derived from isBookingLocked(booking) by the parent — true once the
  // booking is cancelled, at which point every action here is disabled.
  locked: boolean
  onActionComplete?: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [payments, setPayments] = useState<BookingPayment[]>([])
  const [loadingPayments, setLoadingPayments] = useState(true)
  // Distinct from "no payments yet" — a real query failure here must
  // not break the rest of the booking detail view, so this only drives
  // a small note in the History section below.
  const [paymentsFailed, setPaymentsFailed] = useState(false)

  function refetchPayments() {
    setLoadingPayments(true)
    getBookingPayments(bookingId).then(({ payments: rows, failed }) => {
      setPayments(rows)
      setPaymentsFailed(failed)
      setLoadingPayments(false)
    })
  }

  useEffect(() => {
    refetchPayments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId])

  const balance = totalAmount != null ? totalAmount - amountPaid : null
  const overpaidBy = totalAmount != null ? overpaidAmount(amountPaid, totalAmount) : null
  const cancellationFeePayment = payments.find(
    (p) => p.type === 'cancellation_fee' && p.status === 'success' && Number(p.amount) > 0
  )

  // --- Record payment form ---
  const [showRecordForm, setShowRecordForm] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<BookingPaymentMethod>('transfer')
  const [date, setDate] = useState(() => todayInLagos())
  const [note, setNote] = useState('')
  const [recordError, setRecordError] = useState('')
  const [overpaymentPending, setOverpaymentPending] = useState(false)

  function openRecordForm() {
    setAmount('')
    setMethod('transfer')
    setDate(todayInLagos())
    setNote('')
    setRecordError('')
    setOverpaymentPending(false)
    setShowRecordForm(true)
  }

  function submitRecordPayment(allowOverpayment: boolean) {
    const amountNaira = Number(amount)
    if (!(amountNaira > 0)) {
      setRecordError('Enter a payment amount greater than zero.')
      return
    }
    setRecordError('')
    startTransition(async () => {
      const res = await recordPayment(bookingId, {
        amount: amountNaira,
        method,
        note,
        date,
        allowOverpayment,
      })
      if (res.success) {
        setShowRecordForm(false)
        setOverpaymentPending(false)
        refetchPayments()
        onActionComplete?.()
      } else if (res.overpayment) {
        setOverpaymentPending(true)
        setRecordError(res.error)
      } else {
        setRecordError(res.error)
      }
    })
  }

  // --- Void payment ---
  const [pendingVoid, setPendingVoid] = useState<BookingPayment | null>(null)
  const [voidNote, setVoidNote] = useState('')

  function confirmVoid() {
    if (!pendingVoid) return
    const paymentId = pendingVoid.id
    startTransition(async () => {
      const res = await voidPayment(bookingId, paymentId, voidNote)
      setPendingVoid(null)
      setVoidNote('')
      if (res.success) {
        refetchPayments()
        onActionComplete?.()
      }
    })
  }

  return (
    <div className="border-y border-charcoal/10 py-5">
      <p className="text-xs tracking-widest text-charcoal/50 uppercase">Payments</p>

      <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
        <div>
          <dt className="text-charcoal/50">Total</dt>
          <dd className="mt-1 text-charcoal">
            {totalAmount != null ? `₦${totalAmount.toLocaleString()}` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-charcoal/50">Paid</dt>
          <dd className="mt-1 text-charcoal">₦{amountPaid.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-charcoal/50">Balance</dt>
          <dd className="mt-1 text-charcoal">
            {balance != null ? `₦${Math.max(0, balance).toLocaleString()}` : '—'}
          </dd>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs capitalize ${PAYMENT_STYLES[paymentStatus] ?? 'bg-charcoal/10 text-charcoal/60'}`}
        >
          {paymentStatus}
        </span>
        {overpaidBy != null && (
          <span className="inline-block rounded-full bg-brass/20 px-3 py-1 text-xs text-brass">
            Overpaid by ₦{overpaidBy.toLocaleString()}
          </span>
        )}
      </div>

      {locked && !loadingPayments && (
        <p className="mt-3 text-xs text-charcoal/60">
          {cancellationFeePayment
            ? `A cancellation fee of ₦${Number(cancellationFeePayment.amount).toLocaleString()} was charged.`
            : 'No cancellation fee was charged.'}
        </p>
      )}

      {!locked && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => (showRecordForm ? setShowRecordForm(false) : openRecordForm())}
            className="rounded-full border border-charcoal/20 px-3 py-1 text-xs text-charcoal/70 hover:bg-charcoal/5 disabled:opacity-50"
          >
            Record payment
          </button>
        </div>
      )}

      {showRecordForm && !locked && (
        <div className="mt-3 space-y-2 rounded-sm border border-charcoal/10 p-3">
          <div className="grid grid-cols-2 gap-2">
            <MoneyInput value={amount} onChange={setAmount} />
            <Dropdown
              value={method}
              options={PAYMENT_METHOD_OPTIONS}
              onChange={setMethod}
              ariaLabel="Payment method"
              anchor="viewport"
            />
          </div>

          <div>
            <label className="block text-[11px] tracking-widest text-charcoal/50 uppercase">
              Date
            </label>
            <div className="mt-1">
              <DateRangePicker
                mode="single"
                size="compact"
                showBookedLegend={false}
                anchor="viewport"
                allowPast
                maxDate={todayInLagos()}
                blockedRanges={[]}
                initialCheckIn={date}
                onChange={(newDate) => setDate(newDate ?? todayInLagos())}
              />
            </div>
          </div>

          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-sm border border-charcoal/20 px-2 py-1.5 text-sm"
          />
          {recordError && <p className="text-xs text-clay">{recordError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => submitRecordPayment(overpaymentPending)}
              className="rounded-full bg-espresso px-3 py-1.5 text-xs text-ivory hover:bg-espresso/90 disabled:opacity-50"
            >
              {overpaymentPending ? 'Record anyway' : 'Save payment'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowRecordForm(false)
                setRecordError('')
                setOverpaymentPending(false)
              }}
              className="rounded-full border border-charcoal/20 px-3 py-1.5 text-xs text-charcoal/70 hover:bg-charcoal/5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs tracking-widest text-charcoal/50 uppercase">History</p>
        {loadingPayments ? (
          <p className="mt-2 text-xs text-charcoal/50">Loading…</p>
        ) : paymentsFailed ? (
          <div className="mt-2 text-xs text-clay">
            <p>Couldn&apos;t load payments.</p>
            <button
              type="button"
              onClick={refetchPayments}
              className="mt-1 underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        ) : payments.length === 0 ? (
          <p className="mt-2 text-xs text-charcoal/50">No payments recorded yet.</p>
        ) : (
          <table className="mt-2 w-full text-xs">
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-charcoal/10 last:border-0">
                  <td className="py-2 pr-2 whitespace-nowrap text-charcoal/60">
                    {formatLagosDateTime(p.created_at)}
                  </td>
                  <td
                    className={`py-2 pr-2 whitespace-nowrap ${Number(p.amount) < 0 ? 'text-clay' : 'text-charcoal'}`}
                  >
                    {Number(p.amount) < 0 ? '−' : ''}₦{Math.abs(Number(p.amount)).toLocaleString()}
                  </td>
                  <td className="py-2 pr-2 whitespace-nowrap text-charcoal/60 uppercase">
                    {p.method}
                  </td>
                  <td className="py-2 pr-2 text-charcoal/60 capitalize">
                    {p.type.replace('_', ' ')}
                    {p.status === 'failed' && <span className="ml-1 text-clay">(failed)</span>}
                  </td>
                  <td className="py-2 pr-2 text-charcoal/50">{p.note}</td>
                  <td className="py-2 text-right">
                    {!locked && p.status === 'success' && Number(p.amount) > 0 && (
                      <button
                        type="button"
                        onClick={() => setPendingVoid(p)}
                        className="text-charcoal/50 underline underline-offset-2 hover:text-clay"
                      >
                        Void
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        open={pendingVoid !== null}
        title="Void payment"
        message={
          <div>
            <p>
              This records a −₦{pendingVoid ? Number(pendingVoid.amount).toLocaleString() : ''}{' '}
              reversal — the original entry stays in the history, it isn&apos;t deleted.
            </p>
            <input
              type="text"
              placeholder="Reason (optional)"
              value={voidNote}
              onChange={(e) => setVoidNote(e.target.value)}
              className="mt-3 w-full rounded-sm border border-charcoal/20 px-2 py-1.5 text-sm text-charcoal"
            />
          </div>
        }
        confirmLabel="Void payment"
        onConfirm={confirmVoid}
        onCancel={() => {
          setPendingVoid(null)
          setVoidNote('')
        }}
      />
    </div>
  )
}
