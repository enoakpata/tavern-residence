import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Room } from '@/lib/types'
import BookingForm from './BookingForm'

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data: room, error } = await supabase
    .from('Rooms')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !room) {
    notFound()
  }

  const r = room as Room
  const images = r.images && r.images.length > 0 ? r.images : null

  const amenities = [
    'King bed',
    'Air conditioning',
    'Smart TV',
    'Iron',
    'Free Wi-Fi',
    'Ensuite bathroom with shower',
    r.has_kitchenette && 'Kitchenette',
    r.has_living_area && 'Separate living area',
  ].filter(Boolean) as string[]

  return (
    <main className="mx-auto max-w-6xl px-6 py-16 md:px-12 md:py-24">
      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <div className="aspect-[4/3] w-full overflow-hidden rounded-sm bg-verdant/10">
            {images ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={images[0]}
                alt={r.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs tracking-widest text-verdant/40 uppercase">
                Photo coming soon
              </div>
            )}
          </div>

          {images && images.length > 1 && (
            <div className="mt-4 grid grid-cols-4 gap-4">
              {images.slice(1, 5).map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={img}
                  alt={`${r.name} ${i + 2}`}
                  className="aspect-square w-full rounded-sm object-cover"
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs tracking-widest text-brass uppercase">
            {r.room_type} · Room {r.room_number} · {r.floor} floor
          </p>
          <h1 className="mt-3 font-display text-4xl text-charcoal">
            {r.name}
          </h1>
          <p className="mt-4 text-charcoal/70">{r.description}</p>

          <dl className="mt-8 grid grid-cols-2 gap-4 border-y border-charcoal/10 py-6 text-sm">
            <div>
              <dt className="text-charcoal/50">Max occupancy</dt>
              <dd className="mt-1 text-charcoal">{r.max_occupancy} guests</dd>
            </div>
            <div>
              <dt className="text-charcoal/50">Bed</dt>
              <dd className="mt-1 text-charcoal">{r.bed_type}</dd>
            </div>
            {r.room_size_sqm && (
              <div>
                <dt className="text-charcoal/50">Room size</dt>
                <dd className="mt-1 text-charcoal">{r.room_size_sqm} m²</dd>
              </div>
            )}
          </dl>

          <ul className="mt-6 grid grid-cols-2 gap-y-2 text-sm text-charcoal/70">
            {amenities.map((a) => (
              <li key={a} className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-brass" />
                {a}
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <BookingForm room={r} />
          </div>
        </div>
      </div>
    </main>
  )
}
