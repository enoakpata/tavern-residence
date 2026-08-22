import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import { isRoomAvailable } from '@/lib/bookings'
import type { Room } from '@/lib/types'
import { getRoomCoverImage } from '@/lib/roomImages'
import RoomsFilterBar from './RoomsFilterBar'

export const metadata: Metadata = {
  title: 'Rooms & Suites | Tavern Residence',
  description:
    'Browse Studio, 1-Bedroom, and Standard rooms at Tavern Residence in Lekki Phase 1, Lagos — from ₦90,000 to ₦200,000 per night, each with a king bed and kitchenette.',
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const rawCheckIn = typeof params.checkin === 'string' ? params.checkin : ''
  const rawCheckOut = typeof params.checkout === 'string' ? params.checkout : ''
  const hasDates =
    ISO_DATE_PATTERN.test(rawCheckIn) &&
    ISO_DATE_PATTERN.test(rawCheckOut) &&
    rawCheckOut > rawCheckIn

  const { data: rooms, error } = await supabase
    .from('Rooms')
    .select('*')
    .order('room_number', { ascending: true })

  if (error) {
    console.error(error)
    return (
      <main className="mx-auto max-w-6xl px-6 py-24 md:px-12">
        <p className="text-charcoal/70">
          We couldn't load rooms right now. Please try again shortly.
        </p>
      </main>
    )
  }

  const roomList = (rooms ?? []) as Room[]
  roomList.sort((a, b) => Number(a.room_number) - Number(b.room_number))

  // Only checked when both dates are present and valid — with no dates
  // selected, every room stays fully clickable exactly as before.
  const availabilityEntries = hasDates
    ? await Promise.all(
        roomList.map(
          async (room) =>
            [room.id, await isRoomAvailable(room.id, rawCheckIn, rawCheckOut)] as const
        )
      )
    : []
  const availabilityMap = new Map(availabilityEntries)

  return (
    <main className="mx-auto max-w-6xl px-6 py-16 md:px-12 md:py-24">
      <p className="text-xs tracking-widest text-brass uppercase">
        Accommodation
      </p>
      <h1 className="mt-3 font-display text-4xl text-charcoal md:text-5xl">
        Rooms &amp; Suites
      </h1>

      <RoomsFilterBar />

      {roomList.length === 0 ? (
        <p className="mt-16 text-charcoal/60">
          No rooms are listed yet. Check back shortly.
        </p>
      ) : (
        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {roomList.map((room) => {
            const cover = getRoomCoverImage(room.room_number)
            // Availability is only known once dates are picked — before
            // that, cards stay non-interactive rather than defaulting to
            // "available" and clickable.
            const isAvailable = hasDates && availabilityMap.get(room.id) !== false
            const isClickable = hasDates && isAvailable
            const cardContent = (
              <>
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-verdant/10">
                  {cover ? (
                    <Image
                      src={cover}
                      alt={`${room.name} — Room ${room.room_number} at Tavern Residence`}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className={`object-cover transition-transform duration-500 ${isClickable ? 'group-hover:scale-105' : ''}`}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs tracking-widest text-verdant/40 uppercase">
                      Photo coming soon
                    </div>
                  )}
                  {hasDates && !isAvailable && (
                    <div className="absolute inset-0 flex items-center justify-center bg-ivory/80">
                      <span className="rounded-full bg-charcoal px-3 py-1 text-xs tracking-widest text-ivory uppercase">
                        Unavailable for these dates
                      </span>
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
                    {isClickable && (
                      <span className="text-sm text-verdant underline-offset-4 group-hover:underline">
                        View room →
                      </span>
                    )}
                    {!hasDates && (
                      <span className="text-xs text-charcoal/40">
                        Select dates to view
                      </span>
                    )}
                  </div>
                </div>
              </>
            )

            if (!isClickable) {
              return (
                <div
                  key={room.id}
                  className={`flex flex-col overflow-hidden rounded-sm border border-charcoal/10 bg-white ${
                    hasDates ? 'opacity-60' : ''
                  }`}
                >
                  {cardContent}
                </div>
              )
            }

            return (
              <Link
                key={room.id}
                href={`/rooms/${room.id}?checkin=${rawCheckIn}&checkout=${rawCheckOut}`}
                className="group flex flex-col overflow-hidden rounded-sm border border-charcoal/10 bg-white transition-shadow hover:shadow-lg"
              >
                {cardContent}
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
