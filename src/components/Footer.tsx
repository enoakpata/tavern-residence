import { Mail, Phone } from 'lucide-react'
import { FaInstagram } from 'react-icons/fa6'
import {
  GOOGLE_MAPS_URL,
  HOTEL_NAME,
  HOTEL_PHONE_DISPLAY,
  HOTEL_PHONE_TEL,
  HOTEL_EMAIL,
  HOTEL_INSTAGRAM_HANDLE,
  HOTEL_INSTAGRAM_URL,
  HOTEL_ADDRESS_LOCALITY,
  HOTEL_ADDRESS_REGION,
} from '@/lib/siteConfig'

export default function Footer() {
  return (
    <footer className="bg-espresso px-6 py-16 text-ivory md:px-12">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-3">
        <div>
          <p className="font-display text-2xl">{HOTEL_NAME}</p>
          <a
            href={GOOGLE_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block text-sm leading-relaxed text-ivory/70 hover:text-ivory"
          >
            No 20 Dele Adedeji
            <br />
            {HOTEL_ADDRESS_LOCALITY}, {HOTEL_ADDRESS_REGION}
          </a>
        </div>

        <div className="text-sm text-ivory/70">
          <p className="mb-3 text-xs tracking-widest text-ivory uppercase">
            Reach us
          </p>
          <p>
            <a
              href={`tel:${HOTEL_PHONE_TEL}`}
              className="flex items-center gap-2 hover:text-ivory"
            >
              <Phone size={16} className="text-ivory" />
              {HOTEL_PHONE_DISPLAY}
            </a>
          </p>
          <p className="mt-1">
            <a
              href={`mailto:${HOTEL_EMAIL}`}
              className="flex items-center gap-2 hover:text-ivory"
            >
              <Mail size={16} className="text-ivory" />
              {HOTEL_EMAIL}
            </a>
          </p>
          <p className="mt-1">
            <a
              href={HOTEL_INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-ivory"
            >
              <FaInstagram size={16} className="text-ivory" />
              @{HOTEL_INSTAGRAM_HANDLE}
            </a>
          </p>
        </div>

        <div className="text-sm text-ivory/70">
          <p className="mb-3 text-xs tracking-widest text-ivory uppercase">
            Stay
          </p>
          <p>Check-in from 2:00 PM</p>
          <p className="mt-1">Check-out by 12:00 PM</p>
        </div>
      </div>

      <p className="mx-auto mt-16 max-w-6xl text-xs text-ivory/40">
        © {new Date().getFullYear()} {HOTEL_NAME}. All rights reserved.
      </p>
    </footer>
  )
}
