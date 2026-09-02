import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import { getFeaturedRoomPhotos, getGalleryImages } from '@/lib/roomImages'
import { GOOGLE_MAPS_URL } from '@/lib/siteConfig'
import HomeAvailabilityCheck from './HomeAvailabilityCheck'
import AmbientGallery from '@/components/AmbientGallery'

// Without this, Next.js finds no dynamic API in use here and statically
// prerenders the page once at build time — including the gallery folder
// read below, so newly added photos wouldn't appear until a redeploy.
export const dynamic = 'force-dynamic'

const HOMEPAGE_DESCRIPTION =
  'Tavern Residence is a hotel in Lekki Phase 1, Lagos, offering well-appointed rooms, modern facilities, and a welcoming atmosphere suitable for both business and leisure travelers. Guests can enjoy comfortable accommodations, attentive service, and convenient amenities designed to make their stay relaxing and enjoyable.'

export const metadata: Metadata = {
  title: 'Tavern Residence — Hotel in Lekki Phase 1, Lagos',
  description: HOMEPAGE_DESCRIPTION,
  openGraph: {
    title: 'Tavern Residence — Hotel in Lekki Phase 1, Lagos',
    description: HOMEPAGE_DESCRIPTION,
    images: getFeaturedRoomPhotos(1),
  },
}

export default async function Home() {
  const { data: priceRows } = await supabase.from('Rooms').select('price_per_night')
  const prices = (priceRows ?? []).map((p) => p.price_per_night as number)

  const galleryImages = getGalleryImages()

  const hotelJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Hotel',
    name: 'Tavern Residence',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'No 20 Dele Adedeji',
      addressLocality: 'Lekki Phase 1',
      addressRegion: 'Lagos',
      addressCountry: 'NG',
    },
    telephone: '+2347015832637',
    ...(prices.length > 0 && {
      priceRange: `₦${Math.min(...prices).toLocaleString()} - ₦${Math.max(...prices).toLocaleString()}`,
    }),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(hotelJsonLd) }}
      />
      <main>
        {/* Hero */}
        <section className="relative flex min-h-[85vh] flex-col justify-end bg-verdant px-6 pb-16 text-ivory md:px-12 md:pb-24">
          <div className="max-w-2xl">
            <p className="text-xs tracking-widest text-brass uppercase">
              Lekki Phase 1, Lagos
            </p>
            <h1 className="mt-4 font-display text-5xl leading-tight md:text-7xl">
              A quiet residence, minutes from everything.
            </h1>
            <p className="mt-6 max-w-lg text-ivory/80">
              Our hotel offers well-appointed rooms, modern facilities, and a
              welcoming atmosphere suitable for both business and leisure
              travelers. Guests can enjoy comfortable accommodations, attentive
              service, and convenient amenities designed to make their stay
              relaxing and enjoyable. Whether you are visiting for a short
              trip, a business meeting, or a family vacation, our hotel
              provides a comfortable and convenient home away from home.
            </p>
            <div className="mt-8">
              <HomeAvailabilityCheck />
            </div>
          </div>
        </section>

        {/* Gallery */}
        <section className="mx-auto max-w-6xl px-6 py-20 md:px-12 md:py-28">
          <p className="text-xs tracking-widest text-brass uppercase">
            A closer look
          </p>
          <h2 className="mt-3 font-display text-3xl text-charcoal md:text-4xl">
            Around the residence
          </h2>
          <div className="mt-10">
            <AmbientGallery images={galleryImages} alt="Tavern Residence" />
          </div>
        </section>

        {/* Dining */}
        <section className="bg-charcoal px-6 py-20 text-ivory md:px-12 md:py-28">
          <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2 md:items-center">
            <div>
              <p className="text-xs tracking-widest text-brass uppercase">
                In-house dining
              </p>
              <h2 className="mt-3 font-display text-3xl md:text-4xl">
                A chef, a QR code, and whatever you&apos;re craving.
              </h2>
              <p className="mt-4 text-ivory/70">
                Every room has a kitchenette — but if you&apos;d rather not cook,
                scan the QR code in your room to order from our in-house chef.
                Meals are charged separately from your stay.
              </p>
            </div>
          </div>
        </section>

        {/* Location + policies snapshot */}
        <section className="mx-auto max-w-6xl px-6 py-20 md:px-12 md:py-28">
          <div className="grid gap-12 md:grid-cols-3">
            <div>
              <p className="text-xs tracking-widest text-brass uppercase">
                Location
              </p>
              <a
                href={GOOGLE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block text-charcoal hover:text-verdant"
              >
                No 20 Dele Adedeji, Lekki Phase 1, Lagos
              </a>
              <p className="mt-1 text-sm text-charcoal/60">
                Free on-site parking for all guests.
              </p>
            </div>
            <div>
              <p className="text-xs tracking-widest text-brass uppercase">
                Stay times
              </p>
              <p className="mt-3 text-charcoal">Check-in from 2:00 PM</p>
              <p className="text-charcoal">Check-out by 12:00 PM</p>
            </div>
            <div>
              <p className="text-xs tracking-widest text-brass uppercase">
                Good to know
              </p>
              <p className="mt-3 text-sm text-charcoal/60">
                Free cancellation up to 24 hours before check-in. This is a
                non-smoking property.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
