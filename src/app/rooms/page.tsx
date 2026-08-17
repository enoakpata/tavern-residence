import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Room } from '@/lib/types'

export default async function RoomsPage() {
  const { data: rooms, error } = await supabase
    .from('Rooms')
    .select('*')
    .order('price_per_night', { ascending: true })

  if (error) {
    console.error(error)
    return (
      <main className="mx-auto max-w-6xl px-6 py-24 md:px-12">
        <p className="text-charcoal/70">
          We couldn&apos;t load rooms right now. Please try again shortly.
        </p>
      </main>
    )
  }

  const roomList = (rooms ?? []) as Room[]

  return (
    <main className="mx-auto max-w-6xl px-6 py-16 md:px-12 md:py-24">
      <p className="text-xs tracking-widest text-brass uppercase">
        Accommodation
      </p>
      <h1 className="mt-3 font-display text-4xl text-charcoal md:text-5xl">
        Rooms &amp; Suites
      </h1>
      <p className="mt-4 max-w-xl text-charcoal/70">
        Ten rooms, each with a king bed, ensuite bathroom, and its own
        character. Choose the space that fits your stay.
      </p>

      {roomList.length === 0 ? (
        <p className="mt-16 text-charcoal/60">
          No rooms are listed yet. Check back shortly.
        </p>
      ) : (
        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {roomList.map((room) => (
            <Link
              key={room.id}
              href={`/rooms/${room.id}`}
              className="group flex flex-col overflow-hidden rounded-sm border border-charcoal/10 bg-white transition-shadow hover:shadow-lg"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-verdant/10">
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

              <div className="flex flex-1 flex-col p-6">
                <p className="text-xs tracking-widest text-brass uppercase">
                  {room.room_type} · Room {room.room_number}
                </p>
                <h2 className="mt-2 font-display text-2xl text-charcoal">
                  {room.name}
                </h2>
                <p className="mt-2 line-clamp-2 text-sm text-charcoal/60">
                  {room.description}
                </p>

                <div className="mt-auto flex items-end justify-between pt-6">
                  <div>
                    <p className="text-lg text-charcoal">
                      ₦{room.price_per_night.toLocaleString()}
                    </p>
                    <p className="text-xs text-charcoal/50">per night</p>
                  </div>
                  <span className="text-sm text-verdant underline-offset-4 group-hover:underline">
                    View room →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
