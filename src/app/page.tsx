import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import type { Room } from '@/lib/types'
import { getFeaturedRoomPhotos } from '@/lib/roomImages'

export default async function Home() {
  const { data: rooms } = await supabase
    .from('Rooms')
    .select('*')
    .order('price_per_night', { ascending: true })
    .limit(3)

  const featured = (rooms ?? []) as Room[]
  const galleryPhotos = getFeaturedRoomPhotos()

  return (
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
          <Link
            href="/rooms"
            className="mt-8 inline-block rounded-full bg-brass px-8 py-4 text-sm tracking-widest text-verdant uppercase transition-opacity hover:opacity-90"
          >
            Check availability
          </Link>
        </div>
      </section>

      {/* Rooms preview */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:px-12 md:py-28">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs tracking-widest text-brass uppercase">
              Where you&apos;ll stay
            </p>
            <h2 className="mt-3 font-display text-3xl text-charcoal md:text-4xl">
              Studios, suites, and a standard room
            </h2>
          </div>
          <Link
            href="/rooms"
            className="hidden text-sm text-verdant hover:underline sm:inline"
          >
            View all rooms →
          </Link>
        </div>

        {featured.length > 0 && (
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {featured.map((room) => (
              <Link
                key={room.id}
                href={`/rooms/${room.id}`}
                className="group block"
              >
                <div className="aspect-[4/3] w-full overflow-hidden rounded-sm bg-verdant/10">
                  {room.images && room.images.length > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={room.images[0]}
                      alt={room.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs tracking-widest text-verdant/40 uppercase">
                      Photo coming soon
                    </div>
                  )}
                </div>
                <p className="mt-4 font-display text-xl text-charcoal">
                  {room.name}
                </p>
                <p className="mt-1 text-sm text-charcoal/60">
                  From ₦{room.price_per_night.toLocaleString()}/night
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Gallery */}
      {galleryPhotos.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-20 md:px-12 md:py-28">
          <p className="text-xs tracking-widest text-brass uppercase">
            A closer look
          </p>
          <h2 className="mt-3 font-display text-3xl text-charcoal md:text-4xl">
            Around the residence
          </h2>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {galleryPhotos.map((photo) => (
              <div
                key={photo}
                className="relative aspect-square w-full overflow-hidden rounded-sm"
              >
                <Image
                  src={photo}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </section>
      )}

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
            <p className="mt-3 text-charcoal">
              No 20 Dele Adedeji, Lekki Phase 1, Lagos
            </p>
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
  )
}
