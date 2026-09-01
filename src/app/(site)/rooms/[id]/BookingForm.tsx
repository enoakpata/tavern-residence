'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { checkAvailability, createBooking } from './actions'
import DateRangePicker from '@/components/DateRangePicker'
import ConfirmModal from '@/components/ConfirmModal'
import type { Room } from '@/lib/types'
import { formatLagosTime, todayInLagos, type BlockedRange } from '@/lib/dateUtils'

const FREE_CANCELLATION_GRACE_PERIOD_MS = 60 * 60 * 1000

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime()
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)))
}

// Joins validation-error phrases into a natural sentence fragment, e.g.
// "your full name, your phone number, and your email address".
function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

type RequiredTextField = 'guest_name' | 'guest_phone' | 'guest_email'

// The exact message createBooking's server-side re-check returns when the
// room was booked by someone else in the gap between this guest's own
// pre-check and their card being charged — matched here so that specific
// failure (and only that one) triggers the "see other rooms" modal below,
// rather than every possible booking failure.
const ROOM_NO_LONGER_AVAILABLE_ERROR = 'This room is no longer available for those dates.'

// Paystack's inline widget attaches itself to window once its script loads —
// this just tells TypeScript that global exists, since it's not an import.
declare global {
  interface Window {
    PaystackPop?: {
      setup(options: Record<string, unknown>): { openIframe(): void }
    }
  }
}

type Step = 'form' | 'verifying' | 'success' | 'error'

export default function BookingForm({
  room,
  blockedRanges,
  initialCheckIn = null,
  initialCheckOut = null,
}: {
  room: Room
  blockedRanges: BlockedRange[]
  initialCheckIn?: string | null
  initialCheckOut?: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<Step>('form')
  const [errorMessage, setErrorMessage] = useState('')
  const [bookingId, setBookingId] = useState('')
  const [bookingCreatedAt, setBookingCreatedAt] = useState('')
  const [checkIn, setCheckIn] = useState<string | null>(initialCheckIn)
  const [checkOut, setCheckOut] = useState<string | null>(initialCheckOut)
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null)

  // Set instead of the generic inline error whenever the room turns out to
  // have been booked by someone else in the gap between this guest's own
  // check and their card being charged — drives the "see other rooms"
  // modal, carrying the dates they'd already picked.
  const [unavailableDates, setUnavailableDates] = useState<{
    checkIn: string
    checkOut: string
  } | null>(null)

  // Set when Paystack's popup closes without a completed payment (declined
  // card or the guest just closing it) — drives an acknowledgement modal so
  // the guest isn't left on a blank form with no explanation.
  const [paymentNotCompleted, setPaymentNotCompleted] = useState(false)

  // Controlled so React's automatic form reset (which fires once the
  // form's `action` function returns — here, as soon as the policy modal
  // opens, well before payment succeeds or fails) can't wipe out what the
  // guest already typed. Only a genuinely successful booking should lose
  // this, and at that point the form is replaced by the success view
  // entirely, so there's nothing left to reset.
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')

  // Tracks which required text fields are currently missing, so the
  // custom validation below (replacing the browser's native "please fill
  // out this field" popups) can highlight them individually.
  const [invalidFields, setInvalidFields] = useState<Set<RequiredTextField>>(new Set())

  function clearInvalid(field: RequiredTextField) {
    setInvalidFields((prev) => {
      if (!prev.has(field)) return prev
      const next = new Set(prev)
      next.delete(field)
      return next
    })
  }

  // Same-day bookings can never be more than 24 hours from check-in, so
  // they rely on the separate 1-hour-after-booking grace period instead —
  // this note only makes sense for them.
  const isSameDayBooking = checkIn === todayInLagos()

  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0
  const totalPrice = nights * room.price_per_night

  // The success card is far shorter than the booking form, so swapping
  // between them instantly produced a visible layout jerk. Instead, fade
  // the outgoing block out, swap the DOM while fully transparent (so the
  // height change itself is never visible), then fade the new block in.
  const isSuccess = step === 'success'
  const [displaySuccess, setDisplaySuccess] = useState(isSuccess)
  const [contentVisible, setContentVisible] = useState(true)
  const [swapPending, setSwapPending] = useState(false)

  // Adjusting state during render (React's documented pattern for
  // reacting to a prop/state change without an extra effect-triggered
  // render) — this synchronously starts the fade-out the moment `step`
  // flips, rather than one render later.
  if (isSuccess !== displaySuccess && !swapPending) {
    setContentVisible(false)
    setSwapPending(true)
  }

  useEffect(() => {
    if (!swapPending) return
    const timeout = setTimeout(() => {
      setDisplaySuccess(isSuccess)
      setContentVisible(true)
      setSwapPending(false)
    }, 200)
    return () => clearTimeout(timeout)
  }, [swapPending, isSuccess])

  function handleSubmit(formData: FormData) {
    setErrorMessage('')

    // Custom validation in place of the browser's native "please fill out
    // this field" popups (disabled via `noValidate` on the form below) —
    // same required fields, just communicated in the site's own style.
    const missing: string[] = []
    const nextInvalidFields = new Set<RequiredTextField>()

    if (!guestName.trim()) {
      missing.push('your full name')
      nextInvalidFields.add('guest_name')
    }
    if (!guestPhone.trim()) {
      missing.push('your phone number')
      nextInvalidFields.add('guest_phone')
    }
    if (!guestEmail.trim()) {
      missing.push('your email address')
      nextInvalidFields.add('guest_email')
    }
    if (!checkIn || !checkOut) {
      missing.push('your check-in and check-out dates')
    }

    setInvalidFields(nextInvalidFields)

    if (missing.length > 0) {
      setErrorMessage(`Please enter ${joinWithAnd(missing)}.`)
      setStep('error')
      return
    }

    // Before proceeding to the availability check and payment, the guest
    // must see and acknowledge a condensed summary of the policies.
    setPendingFormData(formData)
  }

  function handlePolicyCancel() {
    setPendingFormData(null)
  }

  function handleSeeOtherRooms() {
    if (!unavailableDates) return
    // Same ?checkin=&checkout= param pattern already used elsewhere (the
    // rooms listing page's own date filter, the homepage's availability
    // check), so landing there shows what's actually free immediately.
    const params = new URLSearchParams({
      checkin: unavailableDates.checkIn,
      checkout: unavailableDates.checkOut,
    })
    router.push(`/rooms?${params.toString()}`)
  }

  function handleUnavailableDismiss() {
    setUnavailableDates(null)
  }

  function handlePaymentNotCompletedDismiss() {
    setPaymentNotCompleted(false)
  }

  function handlePolicyConfirm() {
    const formData = pendingFormData
    setPendingFormData(null)
    if (!formData) return

    // Read from formData rather than the checkIn/checkOut state — this
    // function runs from the policy modal's confirm button, a separate
    // closure from the validation in handleSubmit, so re-deriving from the
    // same values already baked into the form's hidden inputs sidesteps
    // needing TypeScript to re-narrow the nullable state here.
    const submittedCheckIn = formData.get('check_in') as string
    const submittedCheckOut = formData.get('check_out') as string
    const submittedGuestEmail = formData.get('guest_email') as string

    startTransition(async () => {
      // Step 1: check the room is actually free before we ever ask for
      // card details — no point charging/refunding ₦100 for a room
      // someone else just booked.
      const availability = await checkAvailability(room.id, submittedCheckIn, submittedCheckOut)
      if (!availability.available) {
        setUnavailableDates({ checkIn: submittedCheckIn, checkOut: submittedCheckOut })
        return
      }

      // Step 2: open Paystack's popup to collect card details and run the
      // ₦100 verification charge. Paystack handles the card entry UI
      // itself — we never see or touch raw card numbers.
      if (!window.PaystackPop) {
        setErrorMessage('Payment system is still loading. Please try again in a moment.')
        setStep('error')
        return
      }

      setStep('verifying')

      const handler = window.PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
        email: submittedGuestEmail,
        amount: 10000, // ₦100 in kobo — refunded automatically after verification
        currency: 'NGN',
        ref: `tavern_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
        callback: (response: { reference: string }) => {
          // Step 3: card charge succeeded on Paystack's side — now hand
          // the reference to our server action, which verifies it,
          // refunds the ₦100, and creates the booking.
          formData.append('paystack_reference', response.reference)
          startTransition(async () => {
            const res = await createBooking(formData)
            if (res.success) {
              setBookingId(res.bookingId)
              setBookingCreatedAt(res.createdAt)
              setStep('success')
            } else if (res.error === ROOM_NO_LONGER_AVAILABLE_ERROR) {
              setStep('form')
              setUnavailableDates({ checkIn: submittedCheckIn, checkOut: submittedCheckOut })
            } else {
              setErrorMessage(res.error)
              setStep('error')
            }
          })
        },
        onClose: () => {
          // Guest closed the popup without completing payment (declined
          // card or they just closed it) — form state (name/phone/email/
          // dates) is untouched since nothing here resets it.
          setStep('form')
          setPaymentNotCompleted(true)
        },
      })

      handler.openIframe()
    })
  }

  return (
    <>
      {/* Loads Paystack's inline widget script once, before it's needed */}
      <Script src="https://js.paystack.co/v1/inline.js" strategy="lazyOnload" />

      <div
        className={`transition-opacity duration-200 ${
          contentVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {displaySuccess ? (
          <div className="rounded-sm border border-verdant/20 bg-verdant/5 p-6">
            <p className="font-display text-xl text-verdant">Request received</p>
            <p className="mt-2 text-sm text-charcoal/70">
              Your card has been verified and your booking request is in. We&apos;ll
              confirm with you shortly by email. Your booking
              reference is{' '}
              <span className="font-medium text-charcoal">
                {bookingId.slice(0, 8)}
              </span>
              .
            </p>
            {isSameDayBooking && bookingCreatedAt && (
              <p className="mt-2 text-sm text-charcoal/70">
                You can cancel for free until{' '}
                {formatLagosTime(
                  new Date(new Date(bookingCreatedAt).getTime() + FREE_CANCELLATION_GRACE_PERIOD_MS)
                )}
                .
              </p>
            )}
          </div>
        ) : (
          <form action={handleSubmit} noValidate className="space-y-5">
            <input type="hidden" name="room_id" value={room.id} />
            <div>
              <label className="text-xs tracking-widest text-charcoal/60 uppercase">
                Dates
              </label>
              <div className="mt-2">
                <DateRangePicker
                  blockedRanges={blockedRanges}
                  initialCheckIn={initialCheckIn}
                  initialCheckOut={initialCheckOut}
                  onChange={(newCheckIn, newCheckOut) => {
                    setCheckIn(newCheckIn)
                    setCheckOut(newCheckOut)
                  }}
                />
              </div>
              <input type="hidden" name="check_in" value={checkIn ?? ''} />
              <input type="hidden" name="check_out" value={checkOut ?? ''} />
            </div>

            <div className="rounded-sm bg-charcoal/5 p-4">
              {nights > 0 ? (
                <p className="text-sm text-charcoal">
                  Total for {nights} night{nights === 1 ? '' : 's'}:{' '}
                  <span className="font-medium">₦{totalPrice.toLocaleString()}</span>
                </p>
              ) : (
                <p className="text-sm text-charcoal/50">
                  Select your dates to see the total
                </p>
              )}
            </div>

            <div>
              <label className="text-xs tracking-widest text-charcoal/60 uppercase">
                Full name
              </label>
              <input
                type="text"
                name="guest_name"
                required
                value={guestName}
                onChange={(e) => {
                  setGuestName(e.target.value)
                  clearInvalid('guest_name')
                }}
                className={`mt-2 w-full rounded-sm border px-4 py-3 text-sm focus:border-verdant focus:outline-none ${
                  invalidFields.has('guest_name') ? 'border-clay' : 'border-charcoal/20'
                }`}
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
                  value={guestPhone}
                  onChange={(e) => {
                    setGuestPhone(e.target.value)
                    clearInvalid('guest_phone')
                  }}
                  className={`mt-2 w-full rounded-sm border px-4 py-3 text-sm focus:border-verdant focus:outline-none ${
                    invalidFields.has('guest_phone') ? 'border-clay' : 'border-charcoal/20'
                  }`}
                />
              </div>
              <div>
                <label className="text-xs tracking-widest text-charcoal/60 uppercase">
                  Email
                </label>
                <input
                  type="email"
                  name="guest_email"
                  required
                  value={guestEmail}
                  onChange={(e) => {
                    setGuestEmail(e.target.value)
                    clearInvalid('guest_email')
                  }}
                  className={`mt-2 w-full rounded-sm border px-4 py-3 text-sm focus:border-verdant focus:outline-none ${
                    invalidFields.has('guest_email') ? 'border-clay' : 'border-charcoal/20'
                  }`}
                />
              </div>
            </div>

            <div className="rounded-sm bg-charcoal/5 p-4 text-xs text-charcoal/60">
              A refundable ₦100 card verification charge will be made and
              immediately refunded to confirm your card. Your card will only be
              charged for your stay closer to check-in, or if our cancellation
              policy applies.
            </div>

            {step === 'error' && errorMessage && (
              <p className="text-sm text-clay">{errorMessage}</p>
            )}

            <button
              type="submit"
              disabled={isPending || step === 'verifying'}
              className="w-full rounded-sm bg-verdant py-4 text-sm tracking-widest text-ivory uppercase transition-colors hover:bg-verdant/90 disabled:opacity-50"
            >
              {step === 'verifying' ? 'Verifying card…' : 'Book now'}
            </button>

            {isSameDayBooking && (
              <p className="text-xs text-charcoal/50">
                Since check-in is today, you&apos;ll have 1 hour after booking
                to cancel for free. After that, cancelling incurs a 50% fee.
              </p>
            )}

            <p className="text-xs text-charcoal/50">
              Free cancellation up to 24 hours before check-in. Cancellations
              within 24 hours or no-shows are charged 50% of the booking value.
            </p>
          </form>
        )}
      </div>

      <ConfirmModal
        open={pendingFormData !== null}
        title="Before you continue"
        message={
          <ul className="list-disc space-y-1.5 pl-4">
            <li>Check-in from 2:00 PM, check-out by 12:00 PM.</li>
            <li>Free cancellation up to 24 hours before check-in.</li>
            <li>
              Same-day bookings: You can cancel free of charge within 1 hour of booking.
              After this period, cancellations and no-shows incur a 50% charge.
            </li>
            <li>
              No pets allowed
            </li>
            <li>
              <strong>Strictly non-smoking</strong> — a <strong>₦200,000</strong> fee applies if
              violated.
            </li>
          </ul>
        }
        confirmLabel="I understand, continue to payment"
        cancelLabel="Back"
        onConfirm={handlePolicyConfirm}
        onCancel={handlePolicyCancel}
      />

      <ConfirmModal
        open={unavailableDates !== null}
        title="No longer available"
        message="Sorry, this room was just booked for those dates by another guest. Would you like to see other rooms available for the same dates?"
        confirmLabel="See other rooms"
        cancelLabel="Choose different dates"
        onConfirm={handleSeeOtherRooms}
        onCancel={handleUnavailableDismiss}
      />

      <ConfirmModal
        open={paymentNotCompleted}
        title="Payment not completed"
        message="Payment wasn't completed. If your card was declined, try a different card, or contact us for help — 0701 583 2637."
        confirmLabel="OK"
        hideCancel
        onConfirm={handlePaymentNotCompletedDismiss}
        onCancel={handlePaymentNotCompletedDismiss}
      />
    </>
  )
}
