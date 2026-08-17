'use client'

import { useState, useTransition } from 'react'
import Script from 'next/script'
import { checkAvailability, createBooking } from './actions'
import DateRangePicker from '@/components/DateRangePicker'
import type { Room } from '@/lib/types'
import type { BlockedRange } from '@/lib/dateUtils'

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
}: {
  room: Room
  blockedRanges: BlockedRange[]
}) {
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<Step>('form')
  const [errorMessage, setErrorMessage] = useState('')
  const [bookingId, setBookingId] = useState('')
  const [checkIn, setCheckIn] = useState<string | null>(null)
  const [checkOut, setCheckOut] = useState<string | null>(null)

  function handleSubmit(formData: FormData) {
    setErrorMessage('')
    const guestEmail = formData.get('guest_email') as string

    if (!checkIn || !checkOut) {
      setErrorMessage('Please select your check-in and check-out dates.')
      setStep('error')
      return
    }

    startTransition(async () => {
      // Step 1: check the room is actually free before we ever ask for
      // card details — no point charging/refunding ₦100 for a room
      // someone else just booked.
      const availability = await checkAvailability(room.id, checkIn, checkOut)
      if (!availability.available) {
        setErrorMessage(availability.error ?? 'This room is not available.')
        setStep('error')
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
        email: guestEmail,
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
              setStep('success')
            } else {
              setErrorMessage(res.error)
              setStep('error')
            }
          })
        },
        onClose: () => {
          // Guest closed the popup without completing payment
          setStep('form')
        },
      })

      handler.openIframe()
    })
  }

  return (
    <>
      {/* Loads Paystack's inline widget script once, before it's needed */}
      <Script src="https://js.paystack.co/v1/inline.js" strategy="lazyOnload" />

      {step === 'success' ? (
        <div className="rounded-sm border border-verdant/20 bg-verdant/5 p-6">
          <p className="font-display text-xl text-verdant">Request received</p>
          <p className="mt-2 text-sm text-charcoal/70">
            Your card has been verified and your booking request is in. We&apos;ll
            confirm with you shortly by phone or WhatsApp. Your booking
            reference is{' '}
            <span className="font-medium text-charcoal">
              {bookingId.slice(0, 8)}
            </span>
            .
          </p>
        </div>
      ) : (
        <form action={handleSubmit} className="space-y-5">
          <div>
            <label className="text-xs tracking-widest text-charcoal/60 uppercase">
              Dates
            </label>
            <div className="mt-2">
              <DateRangePicker
                blockedRanges={blockedRanges}
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
              Full name
            </label>
            <input
              type="text"
              name="guest_name"
              required
              className="mt-2 w-full rounded-sm border border-charcoal/20 px-4 py-3 text-sm focus:border-verdant focus:outline-none"
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
                className="mt-2 w-full rounded-sm border border-charcoal/20 px-4 py-3 text-sm focus:border-verdant focus:outline-none"
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
                className="mt-2 w-full rounded-sm border border-charcoal/20 px-4 py-3 text-sm focus:border-verdant focus:outline-none"
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
            {step === 'verifying'
              ? 'Verifying card…'
              : `Book now — ₦${room.price_per_night.toLocaleString()}/night`}
          </button>

          <p className="text-xs text-charcoal/50">
            Free cancellation up to 24 hours before check-in. Cancellations
            within 24 hours or no-shows are charged 50% of the booking value.
          </p>
        </form>
      )}
    </>
  )
}
