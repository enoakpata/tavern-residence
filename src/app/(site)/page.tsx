import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import { getFeaturedRoomPhotos, getGalleryImages, getRoomCoverImage } from '@/lib/roomImages'
import {
  HOTEL_NAME,
  HOTEL_TAGLINE,
  HOTEL_ADDRESS_LOCALITY,
  HOTEL_ADDRESS_REGION,
  HOTEL_PHONE_TEL,
} from '@/lib/siteConfig'
import { FacilitiesSection, GettingHereSection, BookingInvitation } from './GuestHomeSections'
import PageHero from './PageHero'
import OurRooms, { type RoomCardData } from './OurRooms'
import AroundTheResidence from './AroundTheResidence'
import { ROOM_TYPE_CONTENT, ROOM_TYPE_ORDER } from '@/lib/roomTypeContent'
import { promoOnDate } from '@/lib/pricing'
import { getPromotions } from '@/lib/promotions'
import { todayInLagos } from '@/lib/dateUtils'

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
    .select('id, room_number, name, price_per_night')

  const today = todayInLagos()
  const promos = await getPromotions()
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
      // Real nightly rate from Supabase — never invented — or tonight's
      // promo rate while a promo runs (src/lib/pricing.ts).
      priceFromLabel: (() => {
        const promo = promoOnDate(
          { name: room.name as string, price_per_night: room.price_per_night as number },
          today,
          promos
        )
        return promo
          ? `From ₦${promo.promoRate.toLocaleString()} / night (was ₦${promo.normalRate.toLocaleString()})`
          : `From ₦${(room.price_per_night as number).toLocaleString()} / night`
      })(),
      coverImage: getRoomCoverImage(content.representativeRoomNumber),
    }
  })

  const galleryImages = getGalleryImages()
  // Reusing an already-uploaded gallery photo as the hero background
  // (real property/room photography, just not a dedicated hero shot) —
  // swap for a purpose-shot hero image whenever one exists.
  const heroImage = galleryImages[15] ?? galleryImages[0] ?? null

  // Excluded from the "Around the Residence" section's own pool only —
  // the hero above still picks freely from the full `galleryImages` list,
  // so this doesn't affect which photo ends up as the hero background.
  const residenceGalleryImages = galleryImages
    .filter((src) => !src.endsWith('/1.jpg'))
    .sort((a, b) => Number(b.endsWith('/19.jpg')) - Number(a.endsWith('/19.jpg')))

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
        <PageHero
          image={heroImage ? { src: heroImage, alt: `${HOTEL_NAME}, a private hotel apartment in Lekki Phase 1, Lagos` } : null}
          title="Welcome to Tavern Residence"
          subtitle="A stay to remember"
        />
        <OurRooms rooms={ourRooms} />

        <FacilitiesSection />
        <AroundTheResidence images={residenceGalleryImages} />
        <BookingInvitation />
        <GettingHereSection />
      </main>
    </>
  )
}
