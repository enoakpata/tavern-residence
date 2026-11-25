'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { checkAvailability, createBooking, startOnlinePayment, confirmOnlinePayment } from './actions'
import DateRangePicker from '@/components/DateRangePicker'
import ConfirmModal from '@/components/ConfirmModal'
import type { Room } from '@/lib/types'
import {
  stayTotal,
  promoNightCount,
  type Promotion,
  STANDARD_CHECK_IN_TIME,
  STANDARD_CHECK_OUT_TIME,
  LATE_CHECK_OUT_LATEST_TIME,
  EARLY_LATE_FEE_RATE,
} from '@/lib/pricing'
import { formatLagosTime, hotelTodayInLagos, type BlockedRange } from '@/lib/dateUtils'
import Link from 'next/link'
import { HOTEL_PHONE_DISPLAY, CANCELLATION_FEE_FRACTION, CANCELLATION_POLICY_VERSION } from '@/lib/siteConfig'
import {
  CANCELLATION_POLICY_BULLETS,
  CARD_HOLD_CONSENT_TEXT,
  PAY_ONLINE_CONSENT_TEXT,
} from '@/lib/cancellationPolicy'

// The compact "Before you book" summary (point 2 of the policy-step
// redesign) — short rows, no icons, kept in sync with
// cancellationPolicy.ts's actual rule (the fee % is interpolated, not
// hardcoded) rather than restating the full CANCELLATION_POLICY_BULLETS
// text, which is still shown verbatim in the "View full policy" expansion
// below.
const POLICY_SUMMARY_ROWS = [
  {
    label: 'Check-in / check-out',
    detail: `check-in from ${STANDARD_CHECK_IN_TIME}, check-out by ${STANDARD_CHECK_OUT_TIME}`,
  },
  {
    label: 'Early check-in / late check-out',
    detail: `On request: early check-in any time before ${STANDARD_CHECK_IN_TIME}, late check-out until ${LATE_CHECK_OUT_LATEST_TIME} — ${EARLY_LATE_FEE_RATE * 100}% of the nightly rate each, subject to availability`,  },
  {
    label: 'Pay online',
    detail:
      "The full stay is paid by card now. Online payments are non-refundable — if you cancel or don't arrive, there's no fee and the full amount is kept as credit for a future stay.",
  },
  { label: 'Pay in person', detail: 'Pay the hotel directly on arrival (transfer or card)' },
  { label: 'Cancellation (pay in person)', detail: 'Free up to 24 hours before check-in' },
  {
    label: 'Late cancellation or no-show (pay in person)',
    detail: `${CANCELLATION_FEE_FRACTION * 100}% of one night's rate, charged to your card`,
  },
  { label: 'House rules', detail: 'No pets; no smoking in rooms (₦200,000 fee if violated)' },
]

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

type PaymentOption = 'pay_online' | 'pay_in_person'

// The two selectable payment cards. The total is shown on both.
const PAYMENT_OPTIONS: { value: PaymentOption; title: string; detail: string }[] = [
  { value: 'pay_online', title: 'Pay online', detail: 'Pay the full stay now by card' },
  {
    value: 'pay_in_person',
    title: 'Pay in person',
    detail: "Pay at the hotel when you arrive — we'll save your card for the booking guarantee",
  },
]

export default function BookingForm({
  room,
  promos,
  blockedRanges,
  initialCheckIn = null,
  initialCheckOut = null,
  adults = null,
  childrenCount = null,
}: {
  room: Room
  // Active promotions (src/lib/promotions.ts) — priced into the total.
  promos: Promotion[]
  blockedRanges: BlockedRange[]
  initialCheckIn?: string | null
  initialCheckOut?: string | null
  // Carried through from the availability bar via the URL (/rooms/[id]
  // already refused to render this form at all if this would exceed
  // room.max_occupancy — see page.tsx) — passed on to createBooking as
  // hidden fields purely so it can re-validate server-side too, same as
  // every other value here. Not stored anywhere; there's no guest-count
  // column on Bookings.
  adults?: string | null
  childrenCount?: string | null
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
  // Must be picked before booking — no default, so the guest makes a
  // deliberate choice between paying now and paying at the hotel.
  const [paymentOption, setPaymentOption] = useState<PaymentOption | null>(null)
  // Set once a Pay online booking is confirmed — drives the success
  // screen's "Paid online — ₦X".
  const [paidOnlineAmount, setPaidOnlineAmount] = useState(0)
  // Guards the Paystack popup's onClose firing after a successful payment
  // (it must not show "payment not completed" over the success screen).
  const paymentSucceededRef = useRef(false)
  // The room was taken while a Pay online guest was paying — the payment
  // is refunded automatically, and the unavailable modal says so.
  const [unavailableRefunded, setUnavailableRefunded] = useState(false)

  // Required before the card step can proceed — reset every time the
  // policy modal is (re)opened, so a guest can't check it once, cancel
  // out, and have it silently still count on a later attempt.
  const [consentChecked, setConsentChecked] = useState(false)
  // The compact summary's "View full policy" accordion — collapsed by
  // default each time the modal opens, not remembered across attempts.
  const [showFullPolicy, setShowFullPolicy] = useState(false)

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
  const [specialRequests, setSpecialRequests] = useState('')

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
  // this note only makes sense for them. "Same day" means the current
  // hotel night, so a 1 AM booking for last night counts.
  const isSameDayBooking = checkIn === hotelTodayInLagos()

  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0
  // Same night-by-night pricing createBooking stores (src/lib/pricing.ts)
  // — promo nights at the promo rate, the rest at the normal rate.
  const totalPrice = checkIn && checkOut ? stayTotal(room, checkIn, checkOut, promos) : 0
  const promoNights = checkIn && checkOut ? promoNightCount(room, checkIn, checkOut, promos) : 0

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

    if (!paymentOption) {
      setErrorMessage('Please choose Pay online or Pay in person.')
      setStep('error')
      return
    }

    // Before proceeding to the availability check and payment, the guest
    // must see and acknowledge a condensed summary of the policies.
    setConsentChecked(false)
    setShowFullPolicy(false)
    setPendingFormData(formData)
  }

  function handlePolicyCancel() {
    setPendingFormData(null)
    setConsentChecked(false)
    setShowFullPolicy(false)
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
    setUnavailableRefunded(false)
  }

  function handlePaymentNotCompletedDismiss() {
    setPaymentNotCompleted(false)
  }

  function handlePolicyConfirm() {
    const formData = pendingFormData
    setPendingFormData(null)
    if (!formData || !consentChecked) return

    formData.append('card_consent_policy_version', CANCELLATION_POLICY_VERSION)

    // Read from formData rather than the checkIn/checkOut state — this
    // function runs from the policy modal's confirm button, a separate
    // closure from the validation in handleSubmit, so re-deriving from the
    // same values already baked into the form's hidden inputs sidesteps
    // needing TypeScript to re-narrow the nullable state here.
    const submittedCheckIn = formData.get('check_in') as string
    const submittedCheckOut = formData.get('check_out') as string
    const submittedGuestEmail = formData.get('guest_email') as string

    if (paymentOption === 'pay_online') {
      startPayOnline(formData, submittedCheckIn, submittedCheckOut)
      return
    }

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
        // Card only — only a card payment gives a reusable authorization.
        channels: ['card'],
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

  // Pay online: the server creates a pending booking (holding the room)
  // and returns the exact amount + reference; the popup must use exactly
  // those. The server then verifies the payment itself before confirming —
  // the client never decides the amount or whether it was paid.
  function startPayOnline(formData: FormData, submittedCheckIn: string, submittedCheckOut: string) {
    startTransition(async () => {
      if (!window.PaystackPop) {
        setErrorMessage('Payment system is still loading. Please try again in a moment.')
        setStep('error')
        return
      }

      const start = await startOnlinePayment(formData)
      if (!start.success) {
        if (start.error === ROOM_NO_LONGER_AVAILABLE_ERROR) {
          setUnavailableDates({ checkIn: submittedCheckIn, checkOut: submittedCheckOut })
        } else {
          setErrorMessage(start.error)
          setStep('error')
        }
        return
      }

      paymentSucceededRef.current = false
      setStep('verifying')

      const handler = window.PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
        email: start.email,
        amount: start.amountKobo,
        currency: 'NGN',
        ref: start.reference,
        // Card only — no bank transfer / USSD, so we always get a card
        // authorization back.
        channels: ['card'],
        callback: (response: { reference: string }) => {
          paymentSucceededRef.current = true
          startTransition(async () => {
            const res = await confirmOnlinePayment(response.reference)
            if (res.success) {
              setBookingId(res.bookingId)
              setBookingCreatedAt(res.createdAt)
              setPaidOnlineAmount(res.amountPaid)
              setStep('success')
            } else if (res.error === ROOM_NO_LONGER_AVAILABLE_ERROR) {
              setStep('form')
              setUnavailableRefunded(true)
              setUnavailableDates({ checkIn: submittedCheckIn, checkOut: submittedCheckOut })
            } else {
              setErrorMessage(res.error)
              setStep('error')
            }
          })
        },
        onClose: () => {
          if (paymentSucceededRef.current) return
          // Nothing was charged. The pending booking keeps the room for a
          // short while, then frees it automatically.
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
          <div className="rounded-sm border border-espresso/20 bg-espresso/5 p-6">
            {paidOnlineAmount > 0 ? (
              <>
                <p className="font-display text-xl text-espresso">Booking confirmed</p>
                <p className="mt-2 text-sm text-charcoal">
                  Paid online — ₦{paidOnlineAmount.toLocaleString()}
                </p>
                <p className="mt-2 text-sm text-charcoal/70">
                  Your stay is booked and paid. We&apos;ve emailed your confirmation. Your booking
                  reference is{' '}
                  <span className="font-medium text-charcoal">{bookingId.slice(0, 8)}</span>.
                </p>
              </>
            ) : (
              <>
                <p className="font-display text-xl text-espresso">Request received</p>
                <p className="mt-2 text-sm text-charcoal/70">
                  Your card has been verified and your booking request is in. We&apos;ll
                  confirm with you shortly by email. Your booking
                  reference is{' '}
                  <span className="font-medium text-charcoal">
                    {bookingId.slice(0, 8)}
                  </span>
                  .
                </p>
              </>
            )}
            {isSameDayBooking && bookingCreatedAt && paidOnlineAmount === 0 && (
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
            {adults != null && <input type="hidden" name="adults" value={adults} />}
            {childrenCount != null && <input type="hidden" name="children" value={childrenCount} />}
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
                  {promoNights > 0 && (
                    <span className="mt-1 block text-xs text-charcoal/60">
                      Includes {promoNights === nights ? 'promo pricing' : `${promoNights} night${promoNights === 1 ? '' : 's'} at the promo rate`}.
                    </span>
                  )}
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
                className={`mt-2 w-full rounded-sm border px-4 py-3 text-sm focus:border-espresso focus:outline-none ${
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
                  className={`mt-2 w-full rounded-sm border px-4 py-3 text-sm focus:border-espresso focus:outline-none ${
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
                  className={`mt-2 w-full rounded-sm border px-4 py-3 text-sm focus:border-espresso focus:outline-none ${
                    invalidFields.has('guest_email') ? 'border-clay' : 'border-charcoal/20'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="text-xs tracking-widest text-charcoal/60 uppercase">
                Special requests{' '}
                <span className="normal-case tracking-normal text-charcoal/40">(optional)</span>
              </label>
              <textarea
                name="special_requests"
                rows={3}
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder="Any room preferences or requests? We'll do our best to accommodate them."
                className="mt-2 w-full resize-none rounded-sm border border-charcoal/20 px-4 py-3 text-sm focus:border-espresso focus:outline-none"
              />
            </div>

            <fieldset>
              <legend className="text-xs tracking-widest text-charcoal/60 uppercase">
                How would you like to pay?
              </legend>
              <div role="radiogroup" className="mt-2 grid gap-3 sm:grid-cols-2">
                {PAYMENT_OPTIONS.map((opt) => {
                  const selected = paymentOption === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setPaymentOption(opt.value)
                        if (step === 'error') setErrorMessage('')
                      }}
                      className={`relative rounded-sm border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brass/60 ${
                        selected
                          ? 'border-espresso bg-ivory ring-1 ring-espresso'
                          : 'border-charcoal/15 bg-white hover:border-brass/60'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute top-4 right-4 flex h-4 w-4 items-center justify-center rounded-full border ${
                          selected ? 'border-espresso' : 'border-charcoal/30'
                        }`}
                      >
                        {selected && <span className="h-2 w-2 rounded-full bg-espresso" />}
                      </span>
                      <span className="block pr-6 font-display text-lg text-charcoal">{opt.title}</span>
                      <span className="mt-1 block text-sm text-brass">
                        {nights > 0 ? `₦${totalPrice.toLocaleString()}` : 'Select dates for the total'}
                      </span>
                      <span className="mt-2 block text-xs leading-snug text-charcoal/60">{opt.detail}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            {paymentOption === 'pay_online' && (
              <div className="rounded-sm bg-charcoal/5 p-4 text-xs text-charcoal/60">
                You&apos;ll pay the full total by card in one payment. Online payments are
                non-refundable: if you cancel or don&apos;t arrive, there&apos;s no cancellation
                fee and the full amount is kept as credit for a future stay.
              </div>
            )}

            {paymentOption === 'pay_in_person' && (
              <div className="rounded-sm bg-charcoal/5 p-4 text-xs text-charcoal/60">
                Payment for your stay is made directly to us — by transfer
                or card on arrival. A refundable ₦100 card verification
                charge will be made and immediately refunded, so we can
                securely hold a card on file. That card is only ever charged
                for a cancellation or no-show fee under our cancellation
                policy — never for the stay itself.
              </div>
            )}

            {step === 'error' && errorMessage && (
              <p className="text-sm text-clay">{errorMessage}</p>
            )}

            <button
              type="submit"
              disabled={isPending || step === 'verifying'}
              className="w-full rounded-sm bg-espresso py-4 text-sm tracking-widest text-ivory uppercase transition-colors hover:bg-espresso/90 disabled:opacity-50"
            >
              {step === 'verifying'
                ? paymentOption === 'pay_online'
                  ? 'Processing payment…'
                  : 'Verifying card…'
                : paymentOption === 'pay_online' && nights > 0
                  ? `Pay ₦${totalPrice.toLocaleString()} & book`
                  : 'Book now'}
            </button>

            {isSameDayBooking && paymentOption !== 'pay_online' && (
              <p className="text-xs text-charcoal/50">
                Since check-in is today, you&apos;ll have 1 hour after booking
                to cancel for free. After that, the standard cancellation policy applies.
              </p>
            )}

            <p className="text-xs text-charcoal/50">
              By booking you agree to our{' '}
              <Link href="/policies" target="_blank" className="underline underline-offset-2">
                cancellation policy
              </Link>
              . You&apos;ll see a short summary before payment.
            </p>
          </form>
        )}
      </div>

      <ConfirmModal
        open={pendingFormData !== null}
        title="Before you book"
        message={
          <div>
            <div className="divide-y divide-charcoal/10 border-y border-charcoal/10">
              {POLICY_SUMMARY_ROWS.map((row) => (
                <div key={row.label} className="py-1.5 text-xs leading-snug">
                  <p className="font-semibold text-charcoal">{row.label}</p>
                  <p className="mt-0.5 text-charcoal/70">{row.detail}</p>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowFullPolicy((v) => !v)}
              className="mt-3 text-xs text-charcoal/60 underline underline-offset-2"
            >
              {showFullPolicy ? 'Hide full policy' : 'View full policy'}
            </button>

            {showFullPolicy && (
              <div className="mt-2 rounded-sm bg-charcoal/5 p-3 text-xs">
                <ul className="list-disc space-y-1.5 pl-4 text-charcoal/70">
                  {CANCELLATION_POLICY_BULLETS.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
                <p className="mt-2">
                  <Link href="/policies" target="_blank" className="underline underline-offset-2">
                    Read the full policy page
                  </Link>
                  .
                </p>
              </div>
            )}

            <label className="mt-4 flex items-start gap-2 text-xs text-charcoal/70">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-espresso"
              />
              <span>
                {paymentOption === 'pay_online' ? PAY_ONLINE_CONSENT_TEXT : CARD_HOLD_CONSENT_TEXT}
              </span>
            </label>
          </div>
        }
        confirmLabel="Continue"
        cancelLabel="Back"
        confirmDisabled={!consentChecked}
        onConfirm={handlePolicyConfirm}
        onCancel={handlePolicyCancel}
      />

      <ConfirmModal
        open={unavailableDates !== null}
        title="No longer available"
        message={
          unavailableRefunded
            ? 'Sorry, this room was booked by another guest while you were paying. Your payment is being refunded in full. Would you like to see other rooms available for the same dates?'
            : 'Sorry, this room was just booked for those dates by another guest. Would you like to see other rooms available for the same dates?'
        }
        confirmLabel="See other rooms"
        cancelLabel="Choose different dates"
        onConfirm={handleSeeOtherRooms}
        onCancel={handleUnavailableDismiss}
      />

      <ConfirmModal
        open={paymentNotCompleted}
        title="Payment not completed"
        message={`Payment wasn't completed. If your card was declined, try a different card, or contact us for help — ${HOTEL_PHONE_DISPLAY}.`}
        confirmLabel="OK"
        hideCancel
        onConfirm={handlePaymentNotCompletedDismiss}
        onCancel={handlePaymentNotCompletedDismiss}
      />
    </>
  )
}
