'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createManualBooking, getAvailableRooms } from '../actions'
import DateRangePicker from '@/components/DateRangePicker'
import MoneyInput from '@/components/MoneyInput'
import Dropdown, { type DropdownOption } from '@/components/Dropdown'
import RoomSelect from '@/components/RoomSelect'
import { computePaymentStatus } from '@/lib/bookingStatus'
import { todayInLagos } from '@/lib/dateUtils'
import type { Room, BookingPaymentMethod } from '@/lib/types'

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime()
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)))
}

const PAYMENT_METHOD_OPTIONS: DropdownOption<BookingPaymentMethod>[] = [
  { value: 'transfer', label: 'Transfer' },
  { value: 'pos', label: 'POS' },
]

export default function NewBookingForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [source, setSource] = useState<'walk_in' | 'phone'>('walk_in')

  const [checkIn, setCheckIn] = useState<string | null>(null)
  const [checkOut, setCheckOut] = useState<string | null>(null)
  const [rooms, setRooms] = useState<(Room & { available: boolean })[]>([])
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [roomId, setRoomId] = useState('')

  // --- Payment at booking time (optional) ---
  const [amountPaid, setAmountPaid] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<BookingPaymentMethod>('transfer')
  const [paymentDate, setPaymentDate] = useState(() => todayInLagos())
  const [overpaymentPending, setOverpaymentPending] = useState(false)

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
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0
  const selectedRoom = rooms.find((room) => room.id === roomId)
  const total = nights * (selectedRoom?.price_per_night ?? 0)

  const paidAmount = Number(amountPaid) || 0
  const hasPayment = paidAmount > 0
  const balance = total - paidAmount
  const liveStatus = computePaymentStatus(paidAmount, total)
  const isOverpaying = total > 0 && paidAmount > total

  function handleSubmit(formData: FormData) {
    setError('')

    if (isOverpaying && !overpaymentPending) {
      setOverpaymentPending(true)
      return
    }

    formData.set('amount_paid', amountPaid)
    formData.set('payment_method', paymentMethod)
    formData.set('payment_date', paymentDate)
    formData.set('allow_overpayment', overpaymentPending ? 'true' : 'false')

    startTransition(async () => {
      const res = await createManualBooking(formData)
      if (res.success) {
        router.push('/admin/bookings')
      } else {
        setError(res.error)
        setOverpaymentPending(false)
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
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-sm border border-charcoal/20 px-4 py-3 text-sm has-checked:border-espresso has-checked:bg-espresso/5">
            <input
              type="radio"
              name="source"
              value="walk_in"
              checked={source === 'walk_in'}
              onChange={() => setSource('walk_in')}
            />
            Walk-in
          </label>
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-sm border border-charcoal/20 px-4 py-3 text-sm has-checked:border-espresso has-checked:bg-espresso/5">
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

      {hasDates && roomId && nights > 0 && (
        <div>
          <p className="text-xs tracking-widest text-charcoal/60 uppercase">
            Total
          </p>
          <p className="mt-2 text-base font-medium text-charcoal">
            ₦{total.toLocaleString()} for {nights} night{nights === 1 ? '' : 's'}
          </p>
        </div>
      )}

      <div>
        <label className="text-xs tracking-widest text-charcoal/60 uppercase">
          Guest name
        </label>
        <input
          type="text"
          name="guest_name"
          required
          className="mt-2 w-full rounded-sm border border-charcoal/20 px-4 py-3 text-sm focus:border-espresso focus:outline-none"
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
            className="mt-2 w-full rounded-sm border border-charcoal/20 px-4 py-3 text-sm focus:border-espresso focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs tracking-widest text-charcoal/60 uppercase">
            Email (optional)
          </label>
          <input
            type="email"
            name="guest_email"
            className="mt-2 w-full rounded-sm border border-charcoal/20 px-4 py-3 text-sm focus:border-espresso focus:outline-none"
          />
        </div>
      </div>

      <div className="rounded-sm border border-charcoal/10 p-4">
        <p className="text-xs tracking-widest text-charcoal/60 uppercase">
          Payment (optional)
        </p>
        <div className="mt-3">
          <label className="text-[11px] tracking-widest text-charcoal/50 uppercase">
            Amount paid
          </label>
          <div className="mt-1">
            <MoneyInput
              value={amountPaid}
              onChange={(v) => {
                setAmountPaid(v)
                setOverpaymentPending(false)
              }}
              placeholder="Leave blank if nothing paid yet"
              className="w-full rounded-sm border border-charcoal/20 px-4 py-3 text-sm focus:border-espresso focus:outline-none"
            />
          </div>
        </div>

        {hasPayment && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[11px] tracking-widest text-charcoal/50 uppercase">
                Payment method
              </label>
              <div className="mt-1">
                <Dropdown
                  value={paymentMethod}
                  options={PAYMENT_METHOD_OPTIONS}
                  onChange={setPaymentMethod}
                  ariaLabel="Payment method"
                  anchor="viewport"
                  triggerClassName="flex w-full items-center justify-between rounded-sm border border-charcoal/20 px-4 py-3 text-sm text-charcoal focus:border-espresso focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] tracking-widest text-charcoal/50 uppercase">
                Payment date
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
                  initialCheckIn={paymentDate}
                  onChange={(d) => setPaymentDate(d ?? todayInLagos())}
                />
              </div>
            </div>
          </div>
        )}

        {hasDates && roomId && nights > 0 && (
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-charcoal/10 pt-4 text-sm">
            <div>
              <dt className="text-charcoal/50">Total</dt>
              <dd className="mt-1 text-charcoal">₦{total.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-charcoal/50">Paid</dt>
              <dd className="mt-1 text-charcoal">₦{paidAmount.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-charcoal/50">Balance</dt>
              <dd className="mt-1 text-charcoal">₦{Math.max(0, balance).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-charcoal/50">Status</dt>
              <dd className="mt-1 text-charcoal capitalize">{liveStatus}</dd>
            </div>
          </dl>
        )}

        {isOverpaying && (
          <p className="mt-3 text-xs text-clay">
            This is more than the total (₦{total.toLocaleString()}).
            {overpaymentPending ? ' Click "Create booking" again to confirm.' : ''}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-clay">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-sm bg-espresso py-4 text-sm tracking-widest text-ivory uppercase transition-colors hover:bg-espresso/90 disabled:opacity-50"
      >
        {isPending
          ? 'Creating booking…'
          : isOverpaying && overpaymentPending
            ? 'Confirm and create booking'
            : 'Create booking'}
      </button>
    </form>
  )
}
