'use client'

import { useState, useTransition } from 'react'
import {
  cancelBookingByStaff,
  updateBookingStatus,
  editBookingDates,
  getRoomBlockedRangesForEdit,
  getRoomOptionsForChange,
  changeBookingRoom,
  earlyCheckout,
  setEarlyLateOption,
  setBookingDiscount,
  type EarlyLateKind,
  type RoomChangeOption,
} from './actions'
import ConfirmModal from '@/components/ConfirmModal'
import DateRangePicker from '@/components/DateRangePicker'
import MoneyDispositionChoice, { type MoneyDisposition } from '@/components/MoneyDispositionChoice'
import { getCancellationOutcome } from '@/lib/cancellationPolicy'
import { parseISODate, toISODate, type BlockedRange } from '@/lib/dateUtils'
import {
  stayTotal,
  earlyLateFee,
  bookingTotal,
  type Promotion,
  STANDARD_CHECK_IN_TIME,
  LATE_CHECK_OUT_LATEST_TIME,
} from '@/lib/pricing'

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
  // The room's NORMAL rate (Rooms.price_per_night). Promo pricing is
  // applied on top via roomName + src/lib/pricing.ts, so previews here
  // match exactly what the server actions store.
  pricePerNight: number
  // Exact Rooms.name — the key promo rates are looked up by.
  roomName: string | null
  // Early check-in / late check-out fees already on the booking (null =
  // not added). Carried into every total preview below.
  earlyCheckinFee: number | null
  lateCheckoutFee: number | null
  // Staff discount on the booking (null = none). A % discount is
  // re-applied to the room total in every preview, as the server does.
  discountAmount: number | null
  discountPercent: number | null
  discountReason: string | null
  // Active promotions (from getBookingDetail) — previews price with these.
  promos: Promotion[]
  // Already paid toward this stay — drives both the cancel dialog (no
  // fee/card charge once anything's been paid, section 8) and whether
  // "Early checkout" needs to ask about an overpayment (section 7).
  amountPaid: number
  // Called after any action succeeds — lets a parent that's showing its
  // own snapshot of this booking (the detail modal, which fetches once
  // when opened) know to refetch, since revalidatePath only refreshes the
  // underlying page's Server Components, not this client-held snapshot.
  onActionComplete?: () => void
}

const CANCELLABLE_STATUSES = ['pending', 'confirmed']
const EDITABLE_DATE_STATUSES = ['confirmed', 'checked_in']
const ROOM_CHANGE_LOCKED_STATUSES = ['cancelled', 'checked_out']

// The earliest sensible check-out for a given check-in — the day after,
// since a checkout on the same day as check-in isn't a real stay.
function dayAfter(date: string): string {
  const d = parseISODate(date)
  d.setDate(d.getDate() + 1)
  return toISODate(d)
}

// The latest sensible early-checkout date — strictly before the
// original check-out (an early checkout on the same day as the original
// check-out isn't "early").
function dayBefore(date: string): string {
  const d = parseISODate(date)
  d.setDate(d.getDate() - 1)
  return toISODate(d)
}

function formatDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime()
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)))
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
  roomName,
  earlyCheckinFee,
  lateCheckoutFee,
  discountAmount,
  discountPercent,
  discountReason,
  promos,
  amountPaid,
  onActionComplete,
}: BookingActionsProps) {
  const pricedRoom = { name: roomName, price_per_night: pricePerNight }
  const adjustments = {
    early_checkin_fee: earlyCheckinFee,
    late_checkout_fee: lateCheckoutFee,
    discount_amount: discountAmount,
    discount_percent: discountPercent,
  }
  // Same calculation the server actions store: promo-aware room total,
  // plus early/late fees, minus any discount.
  const previewTotal = (ci: string, co: string) =>
    bookingTotal(stayTotal(pricedRoom, ci, co, promos), adjustments).total
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  // Always shown once Cancel is clicked (not computed/skipped up front) —
  // the admin reviews the policy-suggested fee and reason, then edits or
  // zeroes the amount before confirming; nothing here decides or charges
  // automatically.
  const [pendingCancel, setPendingCancel] = useState<null | { reason: string }>(null)
  const [cancelFeeInput, setCancelFeeInput] = useState('0')
  // Only relevant once amountPaid > 0 — the dialog switches from "fee to
  // charge the card" to "what happens to what's already paid" (section
  // 8), reusing the exact same choice/component as earlyCheckout below.
  const [cancelDisposition, setCancelDisposition] = useState<MoneyDisposition>('hold_credit')
  const [cancelRefundMethod, setCancelRefundMethod] = useState<'transfer' | 'pos'>('transfer')
  const [cancelDispositionNote, setCancelDispositionNote] = useState('')
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

  // --- Change room (section 6) ---
  const [pendingChangeRoom, setPendingChangeRoom] = useState(false)
  const [roomOptions, setRoomOptions] = useState<RoomChangeOption[]>([])
  const [currentTotal, setCurrentTotal] = useState(0)
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [totalChoice, setTotalChoice] = useState<'keep_original' | 'update_to_new_rate'>(
    'keep_original'
  )
  const [changeRoomReason, setChangeRoomReason] = useState('')
  const [notifyGuest, setNotifyGuest] = useState(false)
  const [changeRoomError, setChangeRoomError] = useState('')
  const [changeRoomResult, setChangeRoomResult] = useState<
    null | { success: boolean; message: string }
  >(null)

  // --- Early checkout (section 7) ---
  const [pendingEarlyCheckout, setPendingEarlyCheckout] = useState(false)
  const [earlyCheckoutDate, setEarlyCheckoutDate] = useState('')
  const [earlyDisposition, setEarlyDisposition] = useState<MoneyDisposition>('hold_credit')
  const [earlyRefundMethod, setEarlyRefundMethod] = useState<'transfer' | 'pos'>('transfer')
  const [earlyNote, setEarlyNote] = useState('')
  const [earlyCheckoutError, setEarlyCheckoutError] = useState('')
  const [earlyCheckoutResult, setEarlyCheckoutResult] = useState<
    null | { success: boolean; message: string }
  >(null)

  // --- Early check-in / late check-out ---
  const [pendingEarlyLate, setPendingEarlyLate] = useState<null | { kind: EarlyLateKind; enabled: boolean }>(
    null
  )
  const [earlyLateResult, setEarlyLateResult] = useState<null | { success: boolean; message: string }>(null)

  // --- Discount ---
  const [pendingDiscount, setPendingDiscount] = useState(false)
  const [pendingRemoveDiscount, setPendingRemoveDiscount] = useState(false)
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount')
  const [discountValue, setDiscountValue] = useState('')
  const [discountReasonInput, setDiscountReasonInput] = useState('')
  const [discountError, setDiscountError] = useState('')
  const [discountResult, setDiscountResult] = useState<null | { success: boolean; message: string }>(null)

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
  const canChangeRoom = !ROOM_CHANGE_LOCKED_STATUSES.includes(status)
  // Only a currently checked-in guest can leave early — a confirmed
  // booking hasn't arrived yet (that's "edit dates"), and anything past
  // checked_in has already ended one way or another.
  const canEarlyCheckout = status === 'checked_in'
  const hasAmountPaid = amountPaid > 0
  // Either can be added or removed while the booking is still active —
  // including early check-in for a guest who's already checked in, since
  // staff often record an early arrival after the fact.
  const earlyLateActive = ['pending', 'confirmed', 'checked_in'].includes(status)
  const canAddEarlyCheckin = earlyLateActive && earlyCheckinFee == null
  const canRemoveEarlyCheckin = earlyLateActive && earlyCheckinFee != null
  const canAddLateCheckout = earlyLateActive && lateCheckoutFee == null
  const canRemoveLateCheckout = earlyLateActive && lateCheckoutFee != null
  const earlyLateFeeAmount = earlyLateFee(pricedRoom)
  const hasDiscount = discountAmount != null || discountPercent != null
  const canDiscount = !['cancelled', 'no_show'].includes(status)

  function handleCancelClick() {
    // feeAmount/reason are the policy's suggestion, shown for reference —
    // the admin can edit or zero the amount in the dialog before
    // confirming; nothing here decides or charges automatically. Only
    // relevant when nothing's been paid yet — once amountPaid > 0 the
    // dialog shows the money-disposition choice instead (section 8).
    const { feeAmount, reason } = getCancellationOutcome({ createdAt, checkIn, pricePerNight })
    setPendingCancel({ reason })
    setCancelFeeInput(String(feeAmount))
    setCancelDisposition('hold_credit')
    setCancelRefundMethod('transfer')
    setCancelDispositionNote('')
  }

  function handleConfirmCancel() {
    const feeAmount = Math.max(0, Math.round(Number(cancelFeeInput) || 0))
    setPendingCancel(null)
    setError('')
    startTransition(async () => {
      const res = await cancelBookingByStaff(
        bookingId,
        feeAmount,
        hasAmountPaid
          ? {
            disposition: cancelDisposition,
            refundMethod: cancelRefundMethod,
            note: cancelDispositionNote,
          }
          : undefined
      )
      if (res.success) {
        const dispositionLabel =
          res.moneyDisposition === 'hold_credit'
            ? `₦${amountPaid.toLocaleString()} held as credit for the guest.`
            : res.moneyDisposition === 'refund'
              ? `₦${amountPaid.toLocaleString()} recorded as refunded.`
              : res.moneyDisposition === 'keep'
                ? `₦${amountPaid.toLocaleString()} kept — no refund.`
                : null
        setCancelResult({
          success: true,
          message: dispositionLabel
            ? `Booking cancelled. ${dispositionLabel}`
            : res.feeCharged
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

  function handleChangeRoomClick() {
    setChangeRoomError('')
    setChangeRoomReason('')
    setNotifyGuest(false)
    //setTotalChoice('keep_original')
    setSelectedRoomId('')
    setRoomOptions([])
    setPendingChangeRoom(true)
    startTransition(async () => {
      const res = await getRoomOptionsForChange(bookingId)
      if (res.success) {
        setRoomOptions(res.options)
        setCurrentTotal(res.currentTotal)
      } else {
        setChangeRoomError(res.error)
      }
    })
  }

  function handleConfirmChangeRoom() {
    if (!selectedRoomId) {
      setChangeRoomError('Choose a room.')
      return
    }
    setPendingChangeRoom(false)
    startTransition(async () => {
      const res = await changeBookingRoom(bookingId, selectedRoomId, changeRoomReason, notifyGuest)
      if (res.success) {
        const toRoom = roomOptions.find((r) => r.id === selectedRoomId)
        setChangeRoomResult({
          success: true,
          message: `Room changed to ${toRoom?.roomNumber ?? ''} — ${toRoom?.typeName ?? ''}.`,
        })
        onActionComplete?.()
      } else {
        setChangeRoomResult({ success: false, message: res.error })
      }
    })
  }

  function handleDiscountClick() {
    setDiscountType(discountPercent != null ? 'percent' : 'amount')
    setDiscountValue(
      discountPercent != null ? String(discountPercent) : discountAmount != null ? String(discountAmount) : ''
    )
    setDiscountReasonInput(discountReason ?? '')
    setDiscountError('')
    setPendingDiscount(true)
  }

  function handleConfirmDiscount() {
    const value = Number(discountValue)
    if (!discountValue.trim() || !(value > 0)) {
      setDiscountError('Enter a discount greater than zero.')
      return
    }
    if (discountType === 'percent' && value >= 100) {
      setDiscountError('A percentage discount must be less than 100%.')
      return
    }
    if (!discountReasonInput.trim()) {
      setDiscountError('Add a reason for the discount.')
      return
    }
    setPendingDiscount(false)
    startTransition(async () => {
      const res = await setBookingDiscount(bookingId, {
        type: discountType,
        value,
        reason: discountReasonInput,
      })
      setDiscountResult(
        res.success
          ? {
              success: true,
              message: `Discount of ₦${res.discount.toLocaleString()} applied. New total: ₦${res.newTotal.toLocaleString()}.`,
            }
          : { success: false, message: res.error }
      )
      if (res.success) onActionComplete?.()
    })
  }

  function handleConfirmRemoveDiscount() {
    setPendingRemoveDiscount(false)
    startTransition(async () => {
      const res = await setBookingDiscount(bookingId, null)
      setDiscountResult(
        res.success
          ? { success: true, message: `Discount removed. New total: ₦${res.newTotal.toLocaleString()}.` }
          : { success: false, message: res.error }
      )
      if (res.success) onActionComplete?.()
    })
  }

  function handleConfirmEarlyLate() {
    if (!pendingEarlyLate) return
    const { kind, enabled } = pendingEarlyLate
    setPendingEarlyLate(null)
    startTransition(async () => {
      const res = await setEarlyLateOption(bookingId, kind, enabled)
      const label = kind === 'early_checkin' ? 'Early check-in' : 'Late check-out'
      if (res.success) {
        setEarlyLateResult({
          success: true,
          message: `${label} ${enabled ? 'added' : 'removed'} (₦${res.fee.toLocaleString()}). New total: ₦${res.newTotal.toLocaleString()}.`,
        })
        onActionComplete?.()
      } else {
        setEarlyLateResult({ success: false, message: res.error })
      }
    })
  }

  function handleEarlyCheckoutClick() {
    setEarlyCheckoutError('')
    setEarlyCheckoutDate('')
    setEarlyDisposition('hold_credit')
    setEarlyRefundMethod('transfer')
    setEarlyNote('')
    setPendingEarlyCheckout(true)
  }

  function handleConfirmEarlyCheckout() {
    if (!earlyCheckoutDate) {
      setEarlyCheckoutError('Choose a departure date.')
      return
    }
    if (!(earlyCheckoutDate > checkIn) || !(earlyCheckoutDate < checkOut)) {
      setEarlyCheckoutError('Choose a date between check-in and the original check-out.')
      return
    }
    setPendingEarlyCheckout(false)
    startTransition(async () => {
      const res = await earlyCheckout(bookingId, earlyCheckoutDate, earlyDisposition, earlyRefundMethod, earlyNote)
      if (res.success) {
        setEarlyCheckoutResult({
          success: true,
          message:
            res.overpaid > 0
              ? `Checked out early. ₦${res.overpaid.toLocaleString()} overpayment — ${earlyDisposition === 'hold_credit'
                ? 'held as credit.'
                : earlyDisposition === 'refund'
                  ? 'recorded as refunded.'
                  : 'kept, no refund.'
              }`
              : 'Checked out early.',
        })
        onActionComplete?.()
      } else {
        setEarlyCheckoutResult({ success: false, message: res.error })
      }
    })
  }

  const originalNights = nightsBetween(checkIn, checkOut)
  const newNightsPreview =
    earlyCheckoutDate && earlyCheckoutDate > checkIn
      ? Math.round(
        (parseISODate(earlyCheckoutDate).getTime() - parseISODate(checkIn).getTime()) / (1000 * 60 * 60 * 24)
      )
      : 0
  const unusedNightsPreview = newNightsPreview > 0 ? Math.max(0, originalNights - newNightsPreview) : 0
  const newTotalPreview = newNightsPreview > 0 ? previewTotal(checkIn, earlyCheckoutDate) : 0
  const overpaidPreview = Math.max(0, amountPaid - newTotalPreview)

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

      {canChangeRoom && (
        <button
          disabled={isPending}
          onClick={handleChangeRoomClick}
          className="rounded-full border border-charcoal/20 px-3 py-1 text-xs text-charcoal/70 hover:bg-charcoal/5 disabled:opacity-50"
        >
          Change room
        </button>
      )}

      {canEarlyCheckout && (
        <button
          disabled={isPending}
          onClick={handleEarlyCheckoutClick}
          className="rounded-full border border-charcoal/20 px-3 py-1 text-xs text-charcoal/70 hover:bg-charcoal/5 disabled:opacity-50"
        >
          Early checkout
        </button>
      )}

      {(canAddEarlyCheckin || canRemoveEarlyCheckin) && (
        <button
          disabled={isPending}
          onClick={() => setPendingEarlyLate({ kind: 'early_checkin', enabled: canAddEarlyCheckin })}
          className="rounded-full border border-charcoal/20 px-3 py-1 text-xs text-charcoal/70 hover:bg-charcoal/5 disabled:opacity-50"
        >
          {canAddEarlyCheckin ? 'Add early check-in' : 'Remove early check-in'}
        </button>
      )}

      {(canAddLateCheckout || canRemoveLateCheckout) && (
        <button
          disabled={isPending}
          onClick={() => setPendingEarlyLate({ kind: 'late_checkout', enabled: canAddLateCheckout })}
          className="rounded-full border border-charcoal/20 px-3 py-1 text-xs text-charcoal/70 hover:bg-charcoal/5 disabled:opacity-50"
        >
          {canAddLateCheckout ? 'Add late check-out' : 'Remove late check-out'}
        </button>
      )}

      {canDiscount && (
        <button
          disabled={isPending}
          onClick={handleDiscountClick}
          className="rounded-full border border-charcoal/20 px-3 py-1 text-xs text-charcoal/70 hover:bg-charcoal/5 disabled:opacity-50"
        >
          {hasDiscount ? 'Edit discount' : 'Add discount'}
        </button>
      )}

      {canDiscount && hasDiscount && (
        <button
          disabled={isPending}
          onClick={() => setPendingRemoveDiscount(true)}
          className="rounded-full border border-charcoal/20 px-3 py-1 text-xs text-charcoal/70 hover:bg-charcoal/5 disabled:opacity-50"
        >
          Remove discount
        </button>
      )}

      {error && <p className="w-full text-xs text-clay">{error}</p>}

      <ConfirmModal
        open={pendingCancel !== null}
        title="Cancel booking"
        message={
          hasAmountPaid ? (
            <div>
              <p>
                Guest has paid ₦{amountPaid.toLocaleString()}, so no cancellation fee is charged —
                the saved card won&apos;t be touched.
              </p>
              <MoneyDispositionChoice
                amount={amountPaid}
                disposition={cancelDisposition}
                onDispositionChange={setCancelDisposition}
                refundMethod={cancelRefundMethod}
                onRefundMethodChange={setCancelRefundMethod}
                note={cancelDispositionNote}
                onNoteChange={setCancelDispositionNote}
              />
            </div>
          ) : hasCardOnFile ? (
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
          hasAmountPaid
            ? 'Cancel booking'
            : hasCardOnFile && Number(cancelFeeInput) > 0
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
              Update {guestName}&apos;s stay dates for Room {roomNumber}. The booking total will be
recalculated automatically.
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
            {editCheckIn && editCheckOut && editCheckOut > editCheckIn && (
              <p className="mt-3 text-sm text-charcoal">
                New 
              total: ₦{previewTotal(editCheckIn, editCheckOut).toLocaleString()}{' '}
                ({nightsBetween(editCheckIn, editCheckOut)} nights)
              </p>
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

      <ConfirmModal
        open={pendingChangeRoom}
        title="Change room"
        message={
          <div>
            <p>Move {guestName}&apos;s stay to a different room.</p>
            {changeRoomError && <p className="mt-2 text-xs text-clay">{changeRoomError}</p>}
            <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
              {roomOptions.length === 0 && !changeRoomError && (
                <p className="text-xs text-charcoal/50">Loading rooms…</p>
              )}
              {roomOptions.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center justify-between gap-2 rounded-sm border px-3 py-2 text-sm ${!opt.isFree ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                    } ${selectedRoomId === opt.id ? 'border-espresso bg-espresso/5' : 'border-charcoal/15'}`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="change-room"
                      disabled={!opt.isFree}
                      checked={selectedRoomId === opt.id}
                      onChange={() => setSelectedRoomId(opt.id)}
                    />
                    <span>
                      {opt.roomNumber} · {opt.typeName}
                      {opt.isCurrent ? ' (current)' : ''}
                      {!opt.isFree ? ' — booked these dates' : ''}
                    </span>
                  </span>
                  <span className="text-charcoal/50">₦{opt.pricePerNight.toLocaleString()}/night</span>
                </label>
              ))}
            </div>

            {(() => {
              const selected = roomOptions.find((r) => r.id === selectedRoomId)
              if (!selected || selected.isCurrent) return null
              const newRateTotal = selected.totalForBooking
              return (
                <div className="mt-3 space-y-2 rounded-sm bg-charcoal/5 p-3 text-xs text-charcoal/70">
                  <p>Current total: ₦{currentTotal.toLocaleString()}</p>
                  <p>Total at the new rate: ₦{newRateTotal.toLocaleString()}</p>
                  {/* <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="total-choice"
                      checked={totalChoice === 'keep_original'}
                      onChange={() => setTotalChoice('keep_original')}
                    />
                    Keep original total (₦{currentTotal.toLocaleString()})
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="total-choice"
                      checked={totalChoice === 'update_to_new_rate'}
                      onChange={() => setTotalChoice('update_to_new_rate')}
                    />
                    Update total to the new rate (₦{newRateTotal.toLocaleString()})
                  </label> */}
                </div>
              )
            })()}

            <label className="mt-3 block text-xs tracking-widest text-charcoal/60 uppercase">
              Reason (optional)
            </label>
            <input
              value={changeRoomReason}
              onChange={(e) => setChangeRoomReason(e.target.value)}
              placeholder="e.g. guest request"
              className="mt-1 w-full rounded-sm border border-charcoal/20 px-2 py-1.5 text-sm text-charcoal"
            />

            <label className="mt-3 flex items-center gap-2 text-xs text-charcoal/70">
              <input type="checkbox" checked={notifyGuest} onChange={(e) => setNotifyGuest(e.target.checked)} />
              Notify guest by email (room type only — never a room number)
            </label>
          </div>
        }
        confirmLabel="Change room"
        onConfirm={handleConfirmChangeRoom}
        onCancel={() => setPendingChangeRoom(false)}
      />

      <ConfirmModal
        open={changeRoomResult !== null}
        title={changeRoomResult?.success ? 'Room changed' : 'Change room failed'}
        message={changeRoomResult?.message ?? ''}
        confirmLabel="OK"
        hideCancel
        onConfirm={() => setChangeRoomResult(null)}
        onCancel={() => setChangeRoomResult(null)}
      />

      <ConfirmModal
        open={pendingEarlyCheckout}
        title="Early checkout"
        message={
          <div>
            <p>
              {guestName} is checking out early, before the original check-out of{' '}
              {formatDate(checkOut)}.
            </p>
            <label className="mt-3 block text-xs tracking-widest text-charcoal/60 uppercase">
              Actual departure date
            </label>
            <div className="mt-1">
              <DateRangePicker
                mode="single"
                blockedRanges={[]}
                minDate={dayAfter(checkIn)}
                maxDate={dayBefore(checkOut)}
                allowPast
                initialCheckIn={earlyCheckoutDate || null}
                onChange={(newDate) => {
                  setEarlyCheckoutDate(newDate ?? '')
                  setEarlyCheckoutError('')
                }}
              />
            </div>

            {earlyCheckoutDate && newNightsPreview > 0 && (
              <div className="mt-3 space-y-1 rounded-sm bg-charcoal/5 p-3 text-xs text-charcoal/70">
                <p>Nights stayed: {newNightsPreview}</p>
                <p>Nights unused: {unusedNightsPreview}</p>
                <p>New total: ₦{newTotalPreview.toLocaleString()}</p>
                <p>Already paid: ₦{amountPaid.toLocaleString()}</p>
                {overpaidPreview > 0 && <p>Overpayment: ₦{overpaidPreview.toLocaleString()}</p>}
              </div>
            )}

            {overpaidPreview > 0 && (
              <MoneyDispositionChoice
                amount={overpaidPreview}
                disposition={earlyDisposition}
                onDispositionChange={setEarlyDisposition}
                refundMethod={earlyRefundMethod}
                onRefundMethodChange={setEarlyRefundMethod}
                note={earlyNote}
                onNoteChange={setEarlyNote}
              />
            )}

            {earlyCheckoutError && <p className="mt-2 text-xs text-clay">{earlyCheckoutError}</p>}
          </div>
        }
        confirmLabel="Check out early"
        onConfirm={handleConfirmEarlyCheckout}
        onCancel={() => setPendingEarlyCheckout(false)}
      />

      <ConfirmModal
        open={pendingEarlyLate !== null}
        title={
          pendingEarlyLate?.kind === 'early_checkin'
            ? pendingEarlyLate.enabled
              ? 'Add early check-in'
              : 'Remove early check-in'
            : pendingEarlyLate?.enabled
              ? 'Add late check-out'
              : 'Remove late check-out'
        }
        message={
          pendingEarlyLate?.enabled
            ? pendingEarlyLate.kind === 'early_checkin'
              ? `${guestName} can check in any time before ${STANDARD_CHECK_IN_TIME}. This adds ₦${earlyLateFeeAmount.toLocaleString()} to the booking total.`
              : `${guestName} can check out as late as ${LATE_CHECK_OUT_LATEST_TIME}. This adds ₦${earlyLateFeeAmount.toLocaleString()} to the booking total.`
            : `This removes the ₦${(
              (pendingEarlyLate?.kind === 'early_checkin' ? earlyCheckinFee : lateCheckoutFee) ?? 0
            ).toLocaleString()} fee from the booking total.`
        }
        confirmLabel={pendingEarlyLate?.enabled ? 'Add' : 'Remove'}
        onConfirm={handleConfirmEarlyLate}
        onCancel={() => setPendingEarlyLate(null)}
      />

      <ConfirmModal
        open={pendingDiscount}
        title={hasDiscount ? 'Edit discount' : 'Add discount'}
        message={
          <div>
            <p>
              Choose ₦ (an amount) or % (a percentage) off the room total — not off early check-in /
              late check-out fees. A percentage stays a percentage if the dates or room change later.
            </p>
            <div className="mt-3 flex gap-2">
              <div className="flex shrink-0 overflow-hidden rounded-sm border border-charcoal/20 text-sm">
                {(['amount', 'percent'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setDiscountType(t)
                      setDiscountError('')
                    }}
                    className={`px-3 py-1.5 ${discountType === t ? 'bg-espresso text-ivory' : 'text-charcoal/70'}`}
                  >
                    {t === 'amount' ? '₦' : '%'}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="0"
                step={discountType === 'percent' ? '0.5' : '1000'}
                inputMode="decimal"
                value={discountValue}
                onChange={(e) => {
                  setDiscountValue(e.target.value)
                  setDiscountError('')
                }}
                placeholder={discountType === 'percent' ? 'e.g. 10' : 'e.g. 20000'}
                aria-label={discountType === 'percent' ? 'Percent off' : 'Amount off in naira'}
                className="w-full rounded-sm border border-charcoal/20 px-2 py-1.5 text-sm text-charcoal"
              />
            </div>
            <label className="mt-3 block text-xs tracking-widest text-charcoal/60 uppercase">
              Reason
            </label>
            <input
              value={discountReasonInput}
              onChange={(e) => {
                setDiscountReasonInput(e.target.value)
                setDiscountError('')
              }}
              placeholder="e.g. regular guest, long stay"
              className="mt-1 w-full rounded-sm border border-charcoal/20 px-2 py-1.5 text-sm text-charcoal"
            />
            {discountError && <p className="mt-2 text-xs text-clay">{discountError}</p>}
          </div>
        }
        confirmLabel={hasDiscount ? 'Save discount' : 'Add discount'}
        onConfirm={handleConfirmDiscount}
        onCancel={() => setPendingDiscount(false)}
      />

      <ConfirmModal
        open={pendingRemoveDiscount}
        title="Remove discount"
        message={`This removes the ₦${(discountAmount ?? 0).toLocaleString()} discount and puts it back on the booking total.`}
        confirmLabel="Remove"
        onConfirm={handleConfirmRemoveDiscount}
        onCancel={() => setPendingRemoveDiscount(false)}
      />

      <ConfirmModal
        open={discountResult !== null}
        title={discountResult?.success ? 'Booking updated' : 'Update failed'}
        message={discountResult?.message ?? ''}
        confirmLabel="OK"
        hideCancel
        onConfirm={() => setDiscountResult(null)}
        onCancel={() => setDiscountResult(null)}
      />

      <ConfirmModal
        open={earlyLateResult !== null}
        title={earlyLateResult?.success ? 'Booking updated' : 'Update failed'}
        message={earlyLateResult?.message ?? ''}
        confirmLabel="OK"
        hideCancel
        onConfirm={() => setEarlyLateResult(null)}
        onCancel={() => setEarlyLateResult(null)}
      />

      <ConfirmModal
        open={earlyCheckoutResult !== null}
        title={earlyCheckoutResult?.success ? 'Checked out' : 'Early checkout failed'}
        message={earlyCheckoutResult?.message ?? ''}
        confirmLabel="OK"
        hideCancel
        onConfirm={() => setEarlyCheckoutResult(null)}
        onCancel={() => setEarlyCheckoutResult(null)}
      />
    </div>
  )
}
