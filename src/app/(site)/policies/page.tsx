import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Policies | Tavern Residence',
  description:
    'Check-in from 2:00 PM, check-out by 12:00 PM. Free cancellation up to 24 hours before check-in; a strictly non-smoking property in Lekki Phase 1, Lagos.',
}

export default function PoliciesPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 md:px-12 md:py-24">
      <p className="text-xs tracking-widest text-brass uppercase">
        Good to know
      </p>
      <h1 className="mt-3 font-display text-4xl text-charcoal md:text-5xl">
        Policies
      </h1>
      <p className="mt-4 text-charcoal/70">
        A few things worth knowing before your stay at Tavern Residence.
      </p>

      <div className="mt-14 space-y-12">
        <section>
          <h2 className="font-display text-2xl text-charcoal">
            Check-in &amp; check-out
          </h2>
          <div className="mt-4 space-y-2 text-charcoal/70">
            <p>Check-in: from 2:00 PM</p>
            <p>Check-out: by 12:00 PM</p>
            <p>
              Early check-in or late check-out is available for a fee of 50%
              of the room&apos;s nightly rate, subject to availability.
            </p>
          </div>
        </section>

        <section className="border-t border-charcoal/10 pt-12">
          <h2 className="font-display text-2xl text-charcoal">
            Cancellations &amp; no-shows
          </h2>
          <div className="mt-4 space-y-2 text-charcoal/70">
            <p>
              Free cancellation up to 24 hours before check-in — no charge.
            </p>
            <p>
              Cancellations made within 24 hours of check-in are charged 50%
              of one night&apos;s rate.
            </p>
            <p>No-shows are also charged 50% of one night&apos;s rate.</p>
            <p>
              If you book for same-day check-in, you have 1 hour from the
              time of booking to cancel for free, even if check-in is less
              than 24 hours away. After that grace period, the standard
              cancellation fee applies.
            </p>
          </div>
        </section>

        <section className="border-t border-charcoal/10 pt-12">
          <h2 className="font-display text-2xl text-charcoal">Smoking</h2>
          <div className="mt-4 space-y-2 text-charcoal/70">
            <p>Tavern Residence is a strictly non-smoking property.</p>
            <p>
              Guests found smoking in any room will be charged a cleaning
              fee of ₦200,000.
            </p>
          </div>
        </section>

        <section className="border-t border-charcoal/10 pt-12">
          <h2 className="font-display text-2xl text-charcoal">
            Dining
          </h2>
          <div className="mt-4 space-y-2 text-charcoal/70">
            <p>
              Our in-house chef is available for meals, ordered via the QR
              code menu in your room.
            </p>
            <p>Meals are charged separately from your room rate.</p>
          </div>
        </section>

        <section className="border-t border-charcoal/10 pt-12">
          <h2 className="font-display text-2xl text-charcoal">
            General
          </h2>
          <div className="mt-4 space-y-2 text-charcoal/70">
            <p>Free on-site parking is available for all guests.</p>
            <p>Pets are not permitted.</p>
            <p>Maximum occupancy is 2 guests per room, across all room types.</p>
          </div>
        </section>
      </div>

      <div className="mt-14 border-t border-charcoal/10 pt-8 text-sm text-charcoal/60">
        <p>
          Questions about any of the above? Reach us at{' '}
          <a
            href="tel:+2347015832637"
            className="text-verdant hover:underline"
          >
            0701 583 2637
          </a>{' '}
          or{' '}
          <a
            href="mailto:tavernresidence@gmail.com"
            className="text-verdant hover:underline"
          >
            tavernresidence@gmail.com
          </a>
          .
        </p>
      </div>
    </main>
  )
}
