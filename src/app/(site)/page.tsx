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
// toilet)->102, 1-Bedroom Deluxe (without one)->106, Studio->107. Order
// here is display order for the homepage's Our Rooms section (see
// OurRooms.tsx) — Standard, Studio, 1-Bedroom Deluxe, 1-Bedroom Suite —
// and also sets which side of each alternating row the photo lands on,
// since that's purely a function of position there.
const OUR_ROOMS_ROOM_NUMBERS = ['104', '107', '106', '102']
const OUR_ROOMS_CONTENT: Record<
  string,
  { label: string; description: string; amenities: string[] }
> = {
  '104': {
    label: 'Standard Room',
    description:
      'Relax in this charming bedroom, perfect for solo travelers, couples, or remote workers. The space features a comfortable bedroom and a clean ensuite bathroom, with a dedicated workstation that makes it easy to stay productive during your stay. Enjoy a peaceful atmosphere and all the essentials you need for a comfortable visit.',
    amenities: [
      'King bed',
      'Air conditioning',
      'Smart TV',
      'Iron',
      'Free Wi-Fi',
      'Ensuite bathroom with shower',
    ],
  },
  '107': {
    label: 'Studio',
    description:
      "This charming, private studio suits solo travelers, couples, or remote workers just as well. Alongside a comfortable bedroom and a clean ensuite bathroom, you'll find a convenient dry kitchenette equipped for light cooking — handy for those who'd rather keep meals simple. A dedicated workstation keeps you productive, and every essential is on hand for a comfortable, peaceful stay.",
    amenities: [
      'King bed',
      'Air conditioning',
      'Smart TV',
      'Iron',
      'Free Wi-Fi',
      'Ensuite bathroom with shower',
      'Dry Kitchenette',
    ],
  },
  '106': {
    label: '1-Bedroom Deluxe',
    description:
      "A charming, private one-bedroom apartment built for solo travelers, couples, or remote workers who'd like a bit more room to spread out. It brings together a comfortable bedroom, a bright living room, a clean ensuite bathroom, and a dry kitchenette for light cooking, plus a dedicated workstation for getting things done. A peaceful atmosphere throughout, with everything you need for a comfortable stay.",
    amenities: [
      'King bed',
      'Air conditioning',
      'Smart TV',
      'Iron',
      'Free Wi-Fi',
      'Ensuite bathroom with shower',
      'Dry Kitchenette',
      'Living area',
    ],
  },
  '102': {
    label: '1-Bedroom Suite',
    description:
      "The Residence's most complete one-bedroom apartment — private, charming, and suited to solo travelers, couples, or remote workers alike. Beyond the comfortable bedroom, bright living room, and dry kitchenette for light cooking, a separate guest toilet makes it easy to host without compromise. A dedicated workstation and a peaceful atmosphere round out everything you need for a comfortable stay.",
    amenities: [
      'King bed',
      'Air conditioning',
      'Smart TV',
      'Iron',
      'Free Wi-Fi',
      'Ensuite bathroom with shower',
      'Dry Kitchenette',
      'Living area',
      'Guest Toilet',
    ],
  },
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
      amenities: OUR_ROOMS_CONTENT[num].amenities,
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

        <AroundTheResidence images={residenceGalleryImages} />
      </main>
    </>
  )
}
