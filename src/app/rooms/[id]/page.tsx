import fs from 'fs'
import path from 'path'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import type { Room } from '@/lib/types'
import BookingForm from './BookingForm'
import RoomGallery from '@/components/RoomGallery'

const META_DESCRIPTION_LENGTH = 155

function truncateForMeta(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1).trimEnd()}…`
}

function getRoomImages(roomNumber: string): string[] {
  const folderPath = path.join(process.cwd(), 'public', 'images', roomNumber)
  const coverFileName = `room_${roomNumber}.jpg`

  let files: string[] = []
  try {
    files = fs.readdirSync(folderPath)
  } catch (err) {
    // Folder doesn't exist yet for this room — that's fine, the gallery
    console.log('Could not read folder:', folderPath, err)
    return []
  }
  // TEMP DEBUG — remove once photos are working
  console.log('Folder found:', folderPath, '— files:', files)

  const hasCover = files.includes(coverFileName)
  const rest = files.filter((f) => f !== coverFileName)
  const ordered = hasCover ? [coverFileName, ...rest] : files

  return ordered.map((f) => `/images/${roomNumber}/${f}`)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params

  const { data: room } = await supabase.from('Rooms').select('*').eq('id', id).single()

  if (!room) {
    return { title: 'Room not found | Tavern Residence' }
  }

  const r = room as Room
  const title = `${r.name} | Tavern Residence`
  const description = truncateForMeta(r.description, META_DESCRIPTION_LENGTH)
  const coverImage = getRoomImages(r.room_number)[0]

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: coverImage ? [coverImage] : undefined,
    },
  }
}

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
  const images = getRoomImages(r.room_number)

  // Pull existing bookings for this room so the calendar can grey out
  // dates that are already taken — mirrors the same statuses that count
  // as "blocking" in the server-side availability check.
  const { data: bookings } = await supabase
    .from('Bookings')
    .select('check_in, check_out')
    .eq('room_id', id)
    .in('status', ['pending', 'confirmed', 'checked_in'])

  const blockedRanges = (bookings ?? []).map((b) => ({
    checkIn: b.check_in as string,
    checkOut: b.check_out as string,
  }))

  const amenities = [
    'King bed',
    'Air conditioning',
    'Smart TV',
    'Iron',
    'Free Wi-Fi',
    'Ensuite bathroom with shower',
    r.has_kitchenette && 'Dry Kitchenette',
    r.has_living_area && 'Living area',
  ].filter(Boolean) as string[]

  return (
    <main className="mx-auto max-w-6xl px-6 py-16 md:px-12 md:py-24">
      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <RoomGallery images={images} roomName={r.name} roomNumber={r.room_number} />
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
            <BookingForm room={r} blockedRanges={blockedRanges} />
          </div>
        </div>
      </div>
    </main>
  )
}
