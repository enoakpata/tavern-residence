import Image from 'next/image'
import type { ComponentType } from 'react'
import { BedDouble, AirVent, Tv, Wifi, ShowerHead, CookingPot, Sofa, Toilet } from 'lucide-react'
import IronIcon from '@/components/icons/IronIcon'
import Reveal from '@/components/Reveal'

type AmenityIcon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>

export type RoomCardData = {
  id: string
  label: string
  description: string
  amenities: string[]
  priceFromLabel: string
  coverImage: string | null
}

// One icon per amenity string used across the 4 room types below — thin-
// line lucide icons (matching FeatureStrip.tsx's existing use of the same
// set) for everything lucide already covers; IronIcon is the one
// hand-drawn exception, since lucide has no clothes-iron icon.
const AMENITY_ICONS: Record<string, AmenityIcon> = {
  'King bed': BedDouble,
  'Air conditioning': AirVent,
  'Smart TV': Tv,
  Iron: IronIcon,
  'Free Wi-Fi': Wifi,
  'Ensuite bathroom with shower': ShowerHead,
  'Dry Kitchenette': CookingPot,
  'Living area': Sofa,
  'Guest Toilet': Toilet,
}

// The site's 4 real room types as full-width, alternating image/copy
// rows (image left + copy right, then flipped, repeating) — replaces the
// previous uniform horizontal-scroll card row. Order is whatever `rooms`
// arrives in (set by the caller, page.tsx); which side the image sits on
// is purely a function of position here (even rows: image left, odd
// rows: image right), so reordering rooms upstream automatically keeps
// the alternation correct without this component needing to know room
// identities.
export default function OurRooms({ rooms }: { rooms: RoomCardData[] }) {
  if (rooms.length === 0) return null

  return (
    <section className="section-py mx-auto max-w-6xl px-6 md:px-16">
      <p className="text-center text-xs tracking-widest text-stone uppercase">
        Our Rooms
      </p>
      <h2 className="mt-3 text-center font-display text-3xl text-charcoal md:text-4xl">
        Designed for comfort. <span className="italic">Curated for your stay.</span>
      </h2>

      <div className="mt-16 space-y-16 md:mt-20 md:space-y-24">
        {rooms.map((room, index) => {
          const imageOnRight = index % 2 === 1
          return (
            <Reveal key={room.id}>
              <div className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
                <div
                  className={`relative aspect-[4/3] overflow-hidden rounded-sm bg-verdant/10 ${
                    imageOnRight ? 'md:order-2' : ''
                  }`}
                >
                  {room.coverImage ? (
                    <Image
                      src={room.coverImage}
                      alt={room.label}
                      fill
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs tracking-widest text-verdant/40 uppercase">
                      Photo coming soon
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-display text-2xl text-charcoal md:text-3xl">
                    {room.label}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-stone">
                    {room.description}
                  </p>

                  <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
                    {room.amenities.map((amenity) => {
                      const Icon = AMENITY_ICONS[amenity]
                      return (
                        <li
                          key={amenity}
                          className="flex items-center gap-2 text-xs text-charcoal/70"
                        >
                          {Icon && (
                            <Icon size={16} strokeWidth={1.5} className="shrink-0 text-verdant" />
                          )}
                          {amenity}
                        </li>
                      )
                    })}
                  </ul>

                  <p className="mt-6 text-xs tracking-widest text-charcoal/70 uppercase">
                    {room.priceFromLabel}
                  </p>
                </div>
              </div>
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}
