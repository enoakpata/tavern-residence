'use client'

import { useEffect, useState } from 'react'
import { getBookingAuditLog, type BookingAuditEntry } from './actions'
import { formatLagosDateTime } from '@/lib/dateUtils'

const EVENT_LABELS: Record<BookingAuditEntry['eventType'], string> = {
  room_change: 'Room changed',
  early_checkout: 'Early checkout',
  cancellation_money: 'Cancellation — payment handling',
  early_checkin: 'Early check-in',
  late_checkout: 'Late check-out',
  discount: 'Discount',
  promo_reprice: 'Repriced for a promotion',
}

function describe(entry: BookingAuditEntry): string {
  const d = entry.details
  if (entry.eventType === 'room_change') {
    const from = typeof d.from_type === 'string' ? d.from_type : '—'
    const to = typeof d.to_type === 'string' ? d.to_type : '—'
    const oldTotal = typeof d.old_total === 'number' ? d.old_total : 0
    const newTotal = typeof d.new_total === 'number' ? d.new_total : 0
    const totalNote =
      oldTotal === newTotal ? `total unchanged (₦${newTotal.toLocaleString()})` : `total now ₦${newTotal.toLocaleString()} (was ₦${oldTotal.toLocaleString()})`
    return `${from} → ${to}, ${totalNote}`
  }
  if (entry.eventType === 'early_checkout') {
    const nightsStayed = typeof d.nights_stayed === 'number' ? d.nights_stayed : 0
    const newTotal = typeof d.new_total === 'number' ? d.new_total : 0
    const overpaid = typeof d.overpaid === 'number' ? d.overpaid : 0
    const disposition = typeof d.disposition === 'string' ? d.disposition : null
    const dispositionLabel =
      disposition === 'hold_credit' ? 'held as credit' : disposition === 'refund' ? 'refunded' : disposition === 'keep' ? 'kept' : null
    return `${nightsStayed} night${nightsStayed === 1 ? '' : 's'} stayed, new total ₦${newTotal.toLocaleString()}${
      overpaid > 0 && dispositionLabel ? ` — ₦${overpaid.toLocaleString()} overpayment ${dispositionLabel}` : ''
    }`
  }
  if (entry.eventType === 'early_checkin' || entry.eventType === 'late_checkout') {
    const fee = typeof d.fee === 'number' ? d.fee : 0
    const newTotal = typeof d.new_total === 'number' ? d.new_total : 0
    const verb = d.action === 'removed' ? 'Removed' : 'Added'
    return `${verb} — ₦${fee.toLocaleString()} fee, total now ₦${newTotal.toLocaleString()}`
  }
  if (entry.eventType === 'discount') {
    const amount = typeof d.amount === 'number' ? d.amount : 0
    const newTotal = typeof d.new_total === 'number' ? d.new_total : 0
    if (d.action === 'removed') return `Removed — total now ₦${newTotal.toLocaleString()}`
    const pct = typeof d.percent === 'number' ? ` (${d.percent}%)` : ''
    const verb = d.action === 'changed' ? 'Changed to' : 'Added'
    return `${verb} ₦${amount.toLocaleString()}${pct} off — total now ₦${newTotal.toLocaleString()}`
  }
  if (entry.eventType === 'promo_reprice') {
    const name = typeof d.promotion === 'string' ? d.promotion : 'a promotion'
    const oldTotal = typeof d.old_total === 'number' ? d.old_total : 0
    const newTotal = typeof d.new_total === 'number' ? d.new_total : 0
    return `Repriced for ${name}: ₦${oldTotal.toLocaleString()} → ₦${newTotal.toLocaleString()}`
  }
  // cancellation_money
  const amount = typeof d.amount === 'number' ? d.amount : 0
  const disposition = typeof d.disposition === 'string' ? d.disposition : '—'
  const dispositionLabel = disposition === 'hold_credit' ? 'held as credit' : disposition === 'refund' ? 'refunded' : 'kept'
  return `₦${amount.toLocaleString()} ${dispositionLabel}`
}

/**
 * Read-only history of staff-initiated room changes, early checkouts,
 * and cancellation money decisions — section 6's "Show this change
 * history on the booking", shared with section 7's own audit entries.
 * Fetches independently (same pattern as PaymentsSection) and refetches
 * whenever refreshSignal changes — bumped by BookingDetailModal any time
 * an action in this booking completes, since none of those actions
 * write directly into this component's own state.
 */
export default function BookingAuditHistory({
  bookingId,
  refreshSignal,
}: {
  bookingId: string
  refreshSignal: number
}) {
  const [entries, setEntries] = useState<BookingAuditEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    getBookingAuditLog(bookingId).then(({ entries: rows }) => {
      if (cancelled) return
      setEntries(rows)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [bookingId, refreshSignal])

  if (!loaded || entries.length === 0) return null

  return (
    <div>
      <p className="text-xs tracking-widest text-charcoal/50 uppercase">Change history</p>
      <ul className="mt-2 space-y-2">
        {entries.map((entry) => (
          <li key={entry.id} className="rounded-sm border border-charcoal/10 bg-charcoal/[0.02] p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-charcoal">{EVENT_LABELS[entry.eventType] ?? entry.eventType}</span>
              <span className="text-charcoal/40">{formatLagosDateTime(entry.createdAt)}</span>
            </div>
            <p className="mt-1 text-charcoal/70">{describe(entry)}</p>
            {entry.reason && <p className="mt-1 text-charcoal/50">Reason: {entry.reason}</p>}
            {entry.performedBy && <p className="mt-1 text-charcoal/40">By {entry.performedBy}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
