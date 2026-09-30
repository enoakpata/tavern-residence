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
import AroundTheResidence from './AroundTheResidence'
import { ROOM_TYPE_CONTENT, ROOM_TYPE_ORDER } from '@/lib/roomTypeContent'

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

export default async function Home() {
  const { data: roomRows } = await supabase
    .from('Rooms')
    .select('id, room_number, price_per_night')

  const roomsByNumber = new Map((roomRows ?? []).map((r) => [r.room_number as string, r]))

  // The 4 real, guest-facing room types — exactly these 4, no more. No
  // room number is ever shown; each type maps internally to one
  // representative room only for its photo/id/price (link target). Order
  // (ROOM_TYPE_ORDER, from lib/roomTypeContent.ts) is display order for
  // this section — Standard, Studio, 1-Bedroom Deluxe, 1-Bedroom Suite —
  // and also sets which side of each alternating row the photo lands on,
  // since that's purely a function of position there.
  const ourRooms: RoomCardData[] = ROOM_TYPE_ORDER.filter((key) =>
    roomsByNumber.has(ROOM_TYPE_CONTENT[key].representativeRoomNumber)
  ).map((key) => {
    const content = ROOM_TYPE_CONTENT[key]
    const room = roomsByNumber.get(content.representativeRoomNumber)!
    return {
      id: room.id as string,
      label: content.label,
      description: content.longDescription,
      amenities: content.amenities,
      // Real nightly rate from Supabase — never invented.
      priceFromLabel: `From ₦${(room.price_per_night as number).toLocaleString()} / night`,
      coverImage: getRoomCoverImage(content.representativeRoomNumber),
    }
  })

  const galleryImages = getGalleryImages()
  // Reusing an already-uploaded gallery photo as the hero background
  // (real property/room photography, just not a dedicated hero shot) —
  // swap for a purpose-shot hero image whenever one exists.
  const heroImage = galleryImages[0] ?? null

  // Excluded from the "Around the Residence" section's own pool only —
  // the hero above still picks freely from the full `galleryImages` list,
  // so this doesn't affect which photo ends up as the hero background.
  const residenceGalleryImages = galleryImages.filter((src) => !src.endsWith('/1.jpg'))

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
            (darkest on the left, where the text sits), a single-line
            Fraunces headline in one consistent weight/style throughout
            (no mixed regular/italic treatment). -mt-14/-mt-16 exactly
            cancels the fixed header's own h-14/h-16 (see Header.tsx and
            (site)/layout.tsx's matching pt-14/pt-16), so the photo
            reaches the literal top of the viewport with no gap.
            Homepage-only. */}
        <section className="relative -mt-14 flex h-screen items-center overflow-hidden px-6 text-white md:-mt-16 md:px-16">
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
            <h1 className="font-display text-display-md leading-tight md:text-display-lg">
              Welcome to {HOTEL_NAME}
            </h1>
          </div>
        </section>

        {/* Booking widget. Desktop (md+): floats over the hero's bottom
            edge via a fixed negative margin, entirely within the photo —
            safe there since the widget is a single short row at that
            width, so its rendered height barely varies. Mobile: sits in
            normal flow directly below the hero instead of overlapping it
            — the widget is taller and more variable at narrow widths (see
            its own 4-row stack), so a guessed negative-margin pull-up
            reliably misjudged its height and left it floating mid-photo.
            No overlap to calculate on mobile means no guess to get
            wrong. */}
        <div className="relative z-10 mt-6 px-6 md:-mt-24 md:px-12">
          <HomeAvailabilityCheck />
        </div>

        <OurRooms rooms={ourRooms} />

        <AroundTheResidence images={residenceGalleryImages} />
      </main>
    </>
  )
}
