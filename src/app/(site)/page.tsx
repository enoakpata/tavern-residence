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
import Link from 'next/link'
import { ArrowDown, ArrowUpRight } from 'lucide-react'
import ScrollScene from '@/components/ScrollScene'
import { FacilitiesSection, DiningSection, StayStylesSection } from './GuestHomeSections'
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
  const heroImage = galleryImages[15] ?? galleryImages[0] ?? null

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
        <ScrollScene className="home-hero">
          {heroImage && <Image src={heroImage} alt={`${HOTEL_NAME}, a private hotel apartment in Lekki Phase 1, Lagos`} fill priority sizes="100vw" className="hero-photo object-cover" />}
          <div className="hero-shade" />
          <div className="hero-intro"><span className="hero-location">LEKKI PHASE 1, LAGOS</span><p>A little escape. A warm welcome.<br />Your own place in the heart of Lekki.</p></div>
          <div className="hero-headline"><p>Your stay, beautifully simple.</p><h1>Book your<br />comfort room<br />today.</h1><Link href="/rooms" className="hero-book-link">Find your room <ArrowUpRight size={20} aria-hidden="true" /></Link></div>
          <div className="hero-orbit">
            <div className="hero-orbit-photo"><Image src="/images/102/room_102.jpg" alt="A one-bedroom suite at Tavern Residence" fill sizes="(min-width: 900px) 24vw, 40vw" className="object-cover" /></div>
            <span className="orbit-label orbit-label-one">Unwind <i /></span><span className="orbit-label orbit-label-two">Settle in <i /></span><span className="orbit-label orbit-label-three">Feel at home <i /></span>
          </div>
          <a href="#rooms-preview" className="hero-scroll-link">Scroll to discover <ArrowDown size={16} aria-hidden="true" /></a>
        </ScrollScene>

        <OurRooms rooms={ourRooms} />

        <FacilitiesSection />
        <DiningSection />
        <AroundTheResidence images={residenceGalleryImages} />
        <StayStylesSection />
      </main>
    </>
  )
}
