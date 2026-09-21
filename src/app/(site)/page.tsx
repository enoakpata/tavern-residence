import type { Metadata } from 'next'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { getFeaturedRoomPhotos, getGalleryImages, getRoomCoverImage } from '@/lib/roomImages'
import {
  HOTEL_NAME,
  HOTEL_TAGLINE,
  HOTEL_ADDRESS_LOCALITY,
  HOTEL_ADDRESS_REGION,
  HOTEL_PHONE_TEL,
} from '@/lib/siteConfig'
import HomeAvailabilityCheck from './HomeAvailabilityCheck'
import OurRooms, { type RoomCardData } from './OurRooms'
import FeatureStrip from './FeatureStrip'

// Without this, Next.js finds no dynamic API in use here and statically
// prerenders the page once at build time — including the gallery folder
// read below, so newly added photos wouldn't appear until a redeploy.
export const dynamic = 'force-dynamic'

const HOMEPAGE_TITLE = `${HOTEL_NAME} — Apartment Hotel in ${HOTEL_ADDRESS_LOCALITY}, ${HOTEL_ADDRESS_REGION}`

export const metadata: Metadata = {
  title: HOMEPAGE_TITLE,
  description: HOTEL_TAGLINE,
  openGraph: {
    title: HOMEPAGE_TITLE,
    description: HOTEL_TAGLINE,
    images: getFeaturedRoomPhotos(1),
  },
}

// The 4 real, guest-facing room types — exactly these 4, no more. No room
// number is ever shown; each type maps internally to one representative
// room only for its photo/id/price (link target), per the exact mapping
// established earlier: Standard->104, 1-Bedroom Suite (with a guest
// toilet)->102, 1-Bedroom Deluxe (without one)->106, Studio->107.
const OUR_ROOMS_ROOM_NUMBERS = ['104', '102', '106', '107']
const OUR_ROOMS_CONTENT: Record<string, { label: string; description: string }> = {
  '104': { label: 'Standard Room', description: 'Compact comfort for a short, easy stay.' },
  '102': { label: '1-Bedroom Suite', description: 'Private living area with guest toilet.' },
  '106': { label: '1-Bedroom Deluxe', description: 'Private living area for extended comfort.' },
  '107': { label: 'Studio', description: 'Open-plan living with a dry kitchenette.' },
}

export default async function Home() {
  const { data: roomRows } = await supabase
    .from('Rooms')
    .select('id, room_number, price_per_night')

  const roomsByNumber = new Map((roomRows ?? []).map((r) => [r.room_number as string, r]))

  const ourRooms: RoomCardData[] = OUR_ROOMS_ROOM_NUMBERS.filter((num) =>
    roomsByNumber.has(num)
  ).map((num) => {
    const room = roomsByNumber.get(num)!
    return {
      id: room.id as string,
      label: OUR_ROOMS_CONTENT[num].label,
      description: OUR_ROOMS_CONTENT[num].description,
      // Real nightly rate from Supabase — never invented.
      priceFromLabel: `From ₦${(room.price_per_night as number).toLocaleString()} / night`,
      coverImage: getRoomCoverImage(num),
    }
  })

  const galleryImages = getGalleryImages()
  // Reusing an already-uploaded gallery photo as the hero background
  // (real property/room photography, just not a dedicated hero shot) —
  // swap for a purpose-shot hero image whenever one exists.
  const heroImage = galleryImages[0] ?? null

  const hotelJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Hotel',
    name: HOTEL_NAME,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'No 20 Dele Adedeji',
      addressLocality: HOTEL_ADDRESS_LOCALITY,
      addressRegion: HOTEL_ADDRESS_REGION,
      addressCountry: 'NG',
    },
    telephone: HOTEL_PHONE_TEL,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(hotelJsonLd) }}
      />
      <main>
        {/* Hero — full-bleed photo, diagonal dark-to-transparent overlay
            (darkest on the left, where the text sits), mixed regular/
            italic Fraunces headline. -mt-16/-mt-20 exactly cancels the
            fixed header's own h-16/h-20 (see Header.tsx and
            (site)/layout.tsx's matching pt-16/pt-20), so the photo
            reaches the literal top of the viewport with no gap.
            Homepage-only. */}
        <section className="relative -mt-16 flex h-screen items-center overflow-hidden px-6 text-white md:-mt-20 md:px-16">
          {heroImage && (
            <Image
              src={heroImage}
              alt={`${HOTEL_NAME} — a private hotel apartment in Lekki Phase 1, Lagos`}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-charcoal/85 via-charcoal/40 to-transparent" />

          <div className="relative max-w-xl">
            <h1 className="font-display text-display-sm leading-[1.05] md:text-display-xl">
              Stay,
              <br />
              <span className="italic">quietly elevated.</span>
            </h1>
            <p className="mt-6 font-sans text-sm text-white/80">
              Well-appointed rooms, quiet service.
            </p>
          </div>
        </section>

        {/* Booking widget — floats over the hero's bottom edge, entirely
            within the photo (not extending past it into the section
            below). This margin is independent of the header-sync one
            above — it's sized to the widget's own (now much shorter,
            trust-line-free) height, with a safety margin, not to the
            header. Re-check this if the widget's content ever changes
            height again — an estimate, not a measured value, since there
            was no way to render and measure it live while building this. */}
        <div className="relative z-10 -mt-32 px-6 md:-mt-24 md:px-12">
          <HomeAvailabilityCheck />
        </div>

        <OurRooms rooms={ourRooms} />

        <FeatureStrip />
      </main>
    </>
  )
}
