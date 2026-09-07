import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, MapPin, Phone } from 'lucide-react'
import { FaInstagram } from 'react-icons/fa6'
import {
  GOOGLE_MAPS_URL,
  HOTEL_NAME,
  HOTEL_ADDRESS,
  HOTEL_PHONE_DISPLAY,
  HOTEL_PHONE_TEL,
  HOTEL_EMAIL,
  HOTEL_INSTAGRAM_HANDLE,
  HOTEL_INSTAGRAM_URL,
} from '@/lib/siteConfig'

export const metadata: Metadata = {
  title: `Contact | ${HOTEL_NAME}`,
  description: `Reach ${HOTEL_NAME} at ${HOTEL_ADDRESS} — call or WhatsApp ${HOTEL_PHONE_DISPLAY}, or email ${HOTEL_EMAIL}.`,
}

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 md:px-12 md:py-28">
      <p className="text-xs tracking-widest text-brass uppercase">
        Get in touch
      </p>
      <h1 className="mt-3 font-display text-4xl text-charcoal md:text-5xl">
        Contact
      </h1>
      <p className="mt-4 text-charcoal/70">
        Questions about a booking, or planning a walk-in? Reach us directly —
        we usually respond fastest on WhatsApp.
      </p>

      <div className="mt-12 grid gap-8 sm:grid-cols-2">
        <div className="border-t border-charcoal/10 pt-6">
          <p className="text-xs tracking-widest text-brass uppercase">
            Phone / WhatsApp
          </p>
          <a
            href={`tel:${HOTEL_PHONE_TEL}`}
            className="mt-2 flex items-center gap-2 text-lg text-charcoal hover:text-verdant"
          >
            <Phone size={18} className="text-verdant" />
            {HOTEL_PHONE_DISPLAY}
          </a>
        </div>

        <div className="border-t border-charcoal/10 pt-6">
          <p className="text-xs tracking-widest text-brass uppercase">
            Email
          </p>
          <a
            href={`mailto:${HOTEL_EMAIL}`}
            className="mt-2 flex items-center gap-2 text-lg text-charcoal hover:text-verdant"
          >
            <Mail size={18} className="text-verdant" />
            {HOTEL_EMAIL}
          </a>
        </div>

        <div className="border-t border-charcoal/10 pt-6">
          <p className="text-xs tracking-widest text-brass uppercase">
            Instagram
          </p>
          <a
            href={HOTEL_INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-2 text-lg text-charcoal hover:text-verdant"
          >
            <FaInstagram size={18} className="text-verdant" />
            @{HOTEL_INSTAGRAM_HANDLE}
          </a>
        </div>

        <div className="border-t border-charcoal/10 pt-6">
          <p className="text-xs tracking-widest text-brass uppercase">
            Address
          </p>
          <a
            href={GOOGLE_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-2 text-lg text-charcoal hover:text-verdant"
          >
            <MapPin size={18} className="text-verdant" />
            {HOTEL_ADDRESS}
          </a>
        </div>
      </div>

      <p className="mt-12 border-t border-charcoal/10 pt-6 text-sm text-charcoal/60">
        Can&apos;t find your confirmation email?{' '}
        <Link href="/manage-booking" className="text-verdant hover:underline">
          Look up your booking
        </Link>
        .
      </p>
    </main>
  )
}
