'use client'

import { useState, useTransition } from 'react'
import {
  cancelBookingByStaff,
  updateBookingStatus,
  editBookingDates,
  getRoomBlockedRangesForEdit,
} from './actions'
import ConfirmModal from '@/components/ConfirmModal'
import DateRangePicker from '@/components/DateRangePicker'
import { getCancellationOutcome } from '@/lib/cancellationPolicy'
import { parseISODate, toISODate, type BlockedRange } from '@/lib/dateUtils'

type BookingActionsProps = {
  bookingId: string
  status: string
  checkIn: string
  checkOut: string
  createdAt: string
  guestName: string
  roomNumber: string
  // Derived server-side (getBookingDetail) — never the actual card token,
  // which must never reach the client. See that function's own comment.
  hasCardOnFile: boolean
  pricePerNight: number
  // Called after any action succeeds — lets a parent that's showing its
  // own snapshot of this booking (the detail modal, which fetches once
  // when opened) know to refetch, since revalidatePath only refreshes the
  // underlying page's Server Components, not this client-held snapshot.
  onActionComplete?: () => void
}

const CANCELLABLE_STATUSES = ['pending', 'confirmed']
const EDITABLE_DATE_STATUSES = ['confirmed', 'checked_in']

// The earliest sensible check-out for a given check-in — the day after,
// since a checkout on the same day as check-in isn't a real stay.
function dayAfter(date: string): string {
  const d = parseISODate(date)
  d.setDate(d.getDate() + 1)
  return toISODate(d)
}

function formatDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function BookingActions({
  bookingId,
  status,
  checkIn,
  checkOut,
  createdAt,
  guestName,
  roomNumber,
  hasCardOnFile,
  pricePerNight,
  onActionComplete,
}: BookingActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  // Always shown once Cancel is clicked (not computed/skipped up front) —
  // the admin reviews the policy-suggested fee and reason, then edits or
  // zeroes the amount before confirming; nothing here decides or charges
  // automatically.
  const [pendingCancel, setPendingCancel] = useState<null | { reason: string }>(null)
  const [cancelFeeInput, setCancelFeeInput] = useState('0')
  const [pendingCheckout, setPendingCheckout] = useState(false)
  const [cancelResult, setCancelResult] = useState<null | { success: boolean; message: string }>(
    null
  )
  const [pendingEditDates, setPendingEditDates] = useState(false)
  const [editCheckIn, setEditCheckIn] = useState('')
  const [editCheckOut, setEditCheckOut] = useState('')
  const [editDatesError, setEditDatesError] = useState('')
  const [editDatesResult, setEditDatesResult] = useState<
    null | { success: boolean; message: string }
  >(null)
  const [editDatesBlockedRanges, setEditDatesBlockedRanges] = useState<BlockedRange[]>([])

  function run(
    action: () => Promise<{ success: boolean; error?: string }>,
    errorPrefix = ''
  ) {
    setError('')
    startTransition(async () => {
      const res = await action()
      if (!res.success) {
        setError(`${errorPrefix}${res.error ?? 'Something went wrong.'}`)
      } else {
        onActionComplete?.()
      }
    })
  }

  const canCancel = CANCELLABLE_STATUSES.includes(status)
  const canCheckOut = status === 'checked_in'
  const canEditDates = EDITABLE_DATE_STATUSES.includes(status)
  // Check-in already happened for a checked-in guest, so only check-out
  // stays editable at that point — a confirmed booking (not yet arrived)
  // can still have both moved.
  const canEditCheckIn = status === 'confirmed'

  function handleCancelClick() {
    // feeAmount/reason are the policy's suggestion, shown for reference —
    // the admin can edit or zero the amount in the dialog before
    // confirming; nothing here decides or charges automatically.
    const { feeAmount, reason } = getCancellationOutcome({ createdAt, checkIn, pricePerNight })
    setPendingCancel({ reason })
    setCancelFeeInput(String(feeAmount))
  }

  function handleConfirmCancel() {
    const feeAmount = Math.max(0, Math.round(Number(cancelFeeInput) || 0))
    setPendingCancel(null)
    setError('')
    startTransition(async () => {
      const res = await cancelBookingByStaff(bookingId, feeAmount)
      if (res.success) {
        setCancelResult({
          success: true,
          message: res.feeCharged
            ? `Booking cancelled. A cancellation fee of ₦${res.feeAmount.toLocaleString()} was charged to the guest's card.`
            : 'Booking cancelled — no fee charged.',
        })
        onActionComplete?.()
      } else {
        setCancelResult({ success: false, message: res.error })
      }
    })
  }

  function handleConfirmCheckout() {
    setPendingCheckout(false)
    run(() => updateBookingStatus(bookingId, 'checked_out'))
  }

  function handleEditDatesClick() {
    setEditCheckIn(checkIn)
    setEditCheckOut(checkOut)
    setEditDatesError('')
    setEditDatesBlockedRanges([])
    setPendingEditDates(true)
    startTransition(async () => {
      const ranges = await getRoomBlockedRangesForEdit(bookingId)
      setEditDatesBlockedRanges(ranges)
    })
  }

  function handleConfirmEditDates() {
    if (!editCheckIn || !editCheckOut) {
      setEditDatesError('Please choose both dates.')
      return
    }
    if (editCheckOut <= editCheckIn) {
      setEditDatesError('Check-out must be after check-in.')
      return
    }
    setPendingEditDates(false)
    startTransition(async () => {
      const res = await editBookingDates(bookingId, editCheckIn, editCheckOut)
      if (res.success) {
        setEditDatesResult({
          success: true,
          message: `Dates updated: ${formatDate(editCheckIn)} – ${formatDate(editCheckOut)}.`,
        })
        onActionComplete?.()
      } else {
        setEditDatesResult({ success: false, message: res.error })
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canCheckOut && (
        <button
          disabled={isPending}
          onClick={() => setPendingCheckout(true)}
          className="rounded-full bg-espresso px-3 py-1 text-xs text-ivory hover:bg-espresso/90 disabled:opacity-50"
        >
          Check out
        </button>
      )}

      {canEditDates && (
        <button
          disabled={isPending}
          onClick={handleEditDatesClick}
          className="rounded-full border border-charcoal/20 px-3 py-1 text-xs text-charcoal/70 hover:bg-charcoal/5 disabled:opacity-50"
        >
          Edit dates
        </button>
      )}

      {canCancel && (
        <button
          disabled={isPending}
          onClick={handleCancelClick}
          className="rounded-full border border-charcoal/20 px-3 py-1 text-xs text-charcoal/70 hover:bg-charcoal/5 disabled:opacity-50"
        >
          Cancel booking
        </button>
      )}

      {error && <p className="w-full text-xs text-clay">{error}</p>}

      <ConfirmModal
        open={pendingCancel !== null}
        title="Cancel booking"
        message={
          hasCardOnFile ? (
            <div>
              <p>Policy suggestion: {pendingCancel?.reason}</p>
              <label className="mt-3 block text-xs tracking-widest text-charcoal/60 uppercase">
                Fee to charge (₦)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={cancelFeeInput}
                onChange={(e) => setCancelFeeInput(e.target.value)}
                className="mt-1 w-full rounded-sm border border-charcoal/20 px-2 py-1.5 text-sm text-charcoal"
              />
              <p className="mt-1 text-[11px] text-charcoal/40">Set to 0 to waive the fee.</p>
            </div>
          ) : (
            'No card is on file for this booking, so there is nothing to charge.'
          )
        }
        cancelLabel="Back"
        confirmLabel={
          hasCardOnFile && Number(cancelFeeInput) > 0
            ? `Cancel and charge ₦${Math.round(Number(cancelFeeInput)).toLocaleString()}`
            : 'Cancel without fee'
        }
        onConfirm={handleConfirmCancel}
        onCancel={() => setPendingCancel(null)}
      />

      <ConfirmModal
        open={pendingCheckout}
        title="Check out guest"
        message={`Check out ${guestName} from Room ${roomNumber}? This will make the room available for new bookings again.`}
        confirmLabel="Check out"
        onConfirm={handleConfirmCheckout}
        onCancel={() => setPendingCheckout(false)}
      />

      <ConfirmModal
        open={cancelResult !== null}
        title={cancelResult?.success ? 'Booking cancelled' : 'Cancellation failed'}
        message={cancelResult?.message ?? ''}
        confirmLabel="OK"
        hideCancel
        onConfirm={() => setCancelResult(null)}
        onCancel={() => setCancelResult(null)}
      />

      <ConfirmModal
        open={pendingEditDates}
        title="Edit dates"
        message={
          <div>
            <p>
              Update {guestName}&apos;s stay dates for Room {roomNumber}. This doesn&apos;t
              charge anything — collect any payment difference outside the system.
            </p>
            {canEditCheckIn ? (
              <>
                <label className="mt-4 block text-xs tracking-widest text-charcoal/60 uppercase">
                  Dates
                </label>
                <div className="mt-2">
                  <DateRangePicker
                    blockedRanges={editDatesBlockedRanges}
                    initialCheckIn={editCheckIn}
                    initialCheckOut={editCheckOut}
                    onChange={(newCheckIn, newCheckOut) => {
                      setEditCheckIn(newCheckIn ?? '')
                      setEditCheckOut(newCheckOut ?? '')
                      setEditDatesError('')
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <p className="mt-4 text-xs text-charcoal/50">
                  Check-in: {formatDate(checkIn)} — already checked in, so this can&apos;t change.
                </p>
                <label className="mt-4 block text-xs tracking-widest text-charcoal/60 uppercase">
                  Check-out date
                </label>
                <div className="mt-2">
                  <DateRangePicker
                    mode="single"
                    blockedRanges={editDatesBlockedRanges}
                    minDate={dayAfter(checkIn)}
                    initialCheckIn={editCheckOut}
                    onChange={(newCheckOut) => {
                      setEditCheckOut(newCheckOut ?? '')
                      setEditDatesError('')
                    }}
                  />
                </div>
              </>
            )}
            {editDatesError && <p className="mt-2 text-xs text-clay">{editDatesError}</p>}
          </div>
        }
        confirmLabel="Save dates"
        onConfirm={handleConfirmEditDates}
        onCancel={() => setPendingEditDates(false)}
      />

      <ConfirmModal
        open={editDatesResult !== null}
        title={editDatesResult?.success ? 'Dates updated' : 'Edit dates failed'}
        message={editDatesResult?.message ?? ''}
        confirmLabel="OK"
        hideCancel
        onConfirm={() => setEditDatesResult(null)}
        onCancel={() => setEditDatesResult(null)}
      />
    </div>
  )
}
