import type { Metadata } from 'next'
import {
  HOTEL_NAME,
  HOTEL_PHONE_DISPLAY,
  HOTEL_PHONE_TEL,
  HOTEL_EMAIL,
  HOTEL_ADDRESS_LOCALITY,
  HOTEL_ADDRESS_REGION,
} from '@/lib/siteConfig'
import { CANCELLATION_POLICY_BULLETS } from '@/lib/cancellationPolicy'
import {
  EARLY_LATE_POLICY_TEXT,
  STANDARD_CHECK_IN_TIME,
  STANDARD_CHECK_OUT_TIME,
  LATE_CHECK_OUT_LATEST_TIME,
} from '@/lib/pricing'

export const metadata: Metadata = {
  title: `Policies | ${HOTEL_NAME}`,
  description: `Check-in from ${STANDARD_CHECK_IN_TIME}, check-out by ${STANDARD_CHECK_OUT_TIME}; late check-out until ${LATE_CHECK_OUT_LATEST_TIME} on request. Free cancellation up to 24 hours before check-in; no smoking in rooms, in ${HOTEL_ADDRESS_LOCALITY}, ${HOTEL_ADDRESS_REGION}.`,
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
        A few things worth knowing before your stay at {HOTEL_NAME}.
      </p>

      <div className="mt-14 space-y-12">
        <section>
          <h2 className="font-display text-2xl text-charcoal">
            Check-in &amp; check-out
          </h2>
          <div className="mt-4 space-y-2 text-charcoal/70">
            <p>Check-in: from {STANDARD_CHECK_IN_TIME}</p>
            <p>Check-out: by {STANDARD_CHECK_OUT_TIME}</p>
            <p>{EARLY_LATE_POLICY_TEXT}</p>
          </div>
        </section>

        <section className="border-t border-charcoal/10 pt-12">
          <h2 className="font-display text-2xl text-charcoal">
            Cancellation Policy
          </h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-charcoal/70">
            {CANCELLATION_POLICY_BULLETS.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </section>

        <section className="border-t border-charcoal/10 pt-12">
          <h2 className="font-display text-2xl text-charcoal">Smoking</h2>
          <div className="mt-4 space-y-2 text-charcoal/70">
            <p>No smoking in rooms — a ₦200,000 fee applies if violated.</p>
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
          </div>
        </section>
      </div>

      <div className="mt-14 border-t border-charcoal/10 pt-8 text-sm text-charcoal/60">
        <p>
          Questions about any of the above? Reach us at{' '}
          <a
            href={`tel:${HOTEL_PHONE_TEL}`}
            className="text-espresso hover:underline"
          >
            {HOTEL_PHONE_DISPLAY}
          </a>{' '}
          or{' '}
          <a
            href={`mailto:${HOTEL_EMAIL}`}
            className="text-espresso hover:underline"
          >
            {HOTEL_EMAIL}
          </a>
          .
        </p>
      </div>
    </main>
  )
}
