'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export type RoomCardData = {
  id: string
  label: string
  description: string
  amenities: string[]
  priceFromLabel: string
  coverImage: string | null
}

export default function OurRooms({ rooms }: { rooms: RoomCardData[] }) {
  const track = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  function move(direction: number) {
    const element = track.current
    if (!element) return
    element.scrollBy({ left: direction * (element.clientWidth / 2 + 14), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  function show(index: number) {
    const element = track.current
    const card = element?.children[index] as HTMLElement | undefined
    if (element && card) element.scrollTo({ left: card.offsetLeft - element.offsetLeft, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  return (
    <section id="rooms-preview" className="home-section rooms-preview-section">
      <div className="editorial-heading"><h2>Rooms &amp; Suites</h2><p>Find your own corner of comfort at Tavern Residence. From a restful room to a spacious one-bedroom apartment, each space brings together thoughtful details and the ease of feeling at home.</p><Link href="/rooms" className="quiet-button">Discover all</Link></div>
      {rooms.length > 0 ? <>
        <div className="room-carousel">
          <div ref={track} className="rooms-preview-track" aria-label="Explore our room types" tabIndex={0} onScroll={() => { const element = track.current; if (element) setActive(Math.min(rooms.length - 1, Math.round(element.scrollLeft / (((element.firstElementChild as HTMLElement)?.offsetWidth ?? 0) + 24)))) }}>
            {rooms.map(room => <Link key={room.id} href={'/rooms/' + room.id} className="preview-room-card">
              {room.coverImage && <Image src={room.coverImage} alt={room.label} fill sizes="(min-width: 768px) 45vw, 85vw" className="object-cover" />}
              <div className="photo-shade" /><div className="preview-room-caption"><h3>{room.label}</h3><p>{room.priceFromLabel}</p></div><ChevronRight className="room-card-arrow" size={22} aria-hidden="true" />
            </Link>)}
          </div>
          {rooms.length > 1 && <><button className="slider-arrow previous" onClick={() => move(-1)} aria-label="Previous room"><ChevronLeft size={20} /></button><button className="slider-arrow next" onClick={() => move(1)} aria-label="Next room"><ChevronRight size={20} /></button></>}
        </div>
        <div className="slider-dots">{rooms.map((room, index) => <button key={room.id} onClick={() => show(index)} aria-label={'Show ' + room.label} aria-pressed={active === index} className={active === index ? 'active' : ''} />)}</div>
      </> : <p className="rooms-empty">Explore our room types and plan your stay. <Link href="/rooms">View rooms</Link></p>}
    </section>
  )
}
