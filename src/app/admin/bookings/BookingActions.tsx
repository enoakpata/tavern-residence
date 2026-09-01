'use client'

import { useState, useTransition } from 'react'
import {
  markAsPaid,
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
  paymentStatus: string
  paymentToken: string | null
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
  paymentStatus,
  paymentToken,
  pricePerNight,
  onActionComplete,
}: BookingActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [pendingCancel, setPendingCancel] = useState<
    null | { feeApplies: boolean; feeAmount: number }
  >(null)
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
    // No actual chargeable token on file (e.g. paid by transfer, or a
    // walk-in who paid by POS card with no Paystack token recorded) —
    // always the simple free-cancellation confirm, regardless of timing.
    // payment_method alone isn't the right signal here: a walk-in can have
    // payment_method 'card' with no token at all.
    if (!paymentToken) {
      setPendingCancel({ feeApplies: false, feeAmount: 0 })
      return
    }
    // A booking whose check-in date has already passed naturally falls
    // into the fee branch here too (hoursUntilCheckIn goes negative),
    // which is how a no-show gets its 50% fee without needing a separate
    // button.
    const { free, feeAmount } = getCancellationOutcome({
      createdAt,
      checkIn,
      pricePerNight,
    })
    setPendingCancel({ feeApplies: !free, feeAmount })
  }

  function handleConfirmCancel() {
    setPendingCancel(null)
    setError('')
    startTransition(async () => {
      const res = await cancelBookingByStaff(bookingId)
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
      {paymentStatus === 'unpaid' && (
        <button
          disabled={isPending}
          onClick={() => run(() => markAsPaid(bookingId))}
          className="rounded-full bg-verdant/10 px-3 py-1 text-xs text-verdant hover:bg-verdant/20 disabled:opacity-50"
        >
          Mark as paid
        </button>
      )}

      {canCheckOut && (
        <button
          disabled={isPending}
          onClick={() => setPendingCheckout(true)}
          className="rounded-full bg-verdant px-3 py-1 text-xs text-ivory hover:bg-verdant/90 disabled:opacity-50"
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
          pendingCancel?.feeApplies
            ? `Cancelling now is within 24 hours of check-in. A cancellation fee of ₦${pendingCancel.feeAmount.toLocaleString()} will be charged to this guest's saved card. Continue?`
            : 'Are you sure you want to cancel this booking?'
        }
        confirmLabel={pendingCancel?.feeApplies ? 'Charge fee & cancel' : 'Cancel booking'}
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
