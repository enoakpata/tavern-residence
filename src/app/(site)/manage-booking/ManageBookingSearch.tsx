'use client'

import { useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { findBookings, type BookingSearchResult } from './actions'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending confirmation',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  cancelled: 'Cancelled',
  no_show: 'No-show',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function ManageBookingSearch() {
  const [isPending, startTransition] = useTransition()
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [results, setResults] = useState<BookingSearchResult[] | null>(null)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    startTransition(async () => {
      const { bookings } = await findBookings(phone, email)
      setResults(bookings)
    })
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16 md:px-12 md:py-24">
      <p className="text-xs tracking-widest text-brass uppercase">
        Manage booking
      </p>
      <h1 className="mt-3 font-display text-4xl text-charcoal md:text-5xl">
        Find your booking
      </h1>
      <p className="mt-4 text-charcoal/70">
        Enter the phone number and email address you booked with, and
        we&apos;ll pull up your reservation.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label className="text-xs tracking-widest text-charcoal/60 uppercase">
            Phone / WhatsApp
          </label>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-2 w-full rounded-sm border border-charcoal/20 px-4 py-3 text-sm focus:border-verdant focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs tracking-widest text-charcoal/60 uppercase">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-sm border border-charcoal/20 px-4 py-3 text-sm focus:border-verdant focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-sm bg-verdant py-4 text-sm tracking-widest text-ivory uppercase transition-colors hover:bg-verdant/90 disabled:opacity-50"
        >
          {isPending ? 'Searching…' : 'Find my booking'}
        </button>
      </form>

      {results !== null && (
        <div className="mt-10">
          {results.length === 0 ? (
            <p className="text-sm text-charcoal/70">
              No booking found with those details. Double-check your phone
              number and email, or{' '}
              <Link href="/contact" className="text-verdant hover:underline">
                contact us
              </Link>{' '}
              for help.
            </p>
          ) : (
            <ul className="space-y-4">
              {results.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/booking/${b.id}`}
                    className="block rounded-sm border border-charcoal/10 bg-white p-5 transition-colors hover:border-verdant/40"
                  >
                    <p className="text-xs tracking-widest text-brass uppercase">
                      {b.room_number ? `${b.room_number} — ${b.room_name}` : b.room_name}
                    </p>
                    <p className="mt-2 text-charcoal">
                      {formatDate(b.check_in)} – {formatDate(b.check_out)}
                    </p>
                    <p className="mt-1 text-sm text-charcoal/60">
                      {STATUS_LABELS[b.status] ?? b.status}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  )
}
