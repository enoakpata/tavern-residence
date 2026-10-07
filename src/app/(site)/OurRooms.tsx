"use client"

import { useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react'
import Reveal from '@/components/Reveal'
import HomeAvailabilityCheck from './HomeAvailabilityCheck'

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
  function move(direction: number) {
    const element = track.current
    if (!element) return
    element.scrollBy({ left: direction * (element.clientWidth / 3 + 16), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  return (
    <section id="rooms-preview" className="home-section rooms-preview-section">
      <Reveal className="rooms-preview-copy">
        {rooms.length > 0 && <div ref={track} className="rooms-preview-track" aria-label="Explore our room types" tabIndex={0}>
          {rooms.map((room) => <Link key={room.id} href={`/rooms/${room.id}`} className="preview-room-card">
            {room.coverImage && <Image src={room.coverImage} alt={room.label} fill sizes="(min-width: 900px) 23vw, 60vw" className="object-cover" />}
            <div className="photo-shade" />
            <span className="room-detail-tag">Details <ArrowUpRight size={12} aria-hidden="true" /></span>
            <div className="preview-room-caption"><h3>{room.label}</h3><p>{room.priceFromLabel}</p></div>
          </Link>)}
        </div>}
        <div className="rooms-preview-heading">
          <h2 className="section-title">Choose the best room<br />for your perfect stay.</h2>
          {rooms.length > 1 && <div className="carousel-controls">
            <button type="button" onClick={() => move(-1)} aria-label="Previous rooms"><ChevronLeft size={18} /></button>
            <button type="button" onClick={() => move(1)} aria-label="Next rooms"><ChevronRight size={18} /></button>
          </div>}
        </div>
        <p className="section-description">Find your own little corner of comfort.<br />Four room types. One warm welcome.</p>
        <Link href="/rooms" className="outline-pill">Explore rooms <span className="pill-icon"><ArrowUpRight size={17} aria-hidden="true" /></span></Link>
      </Reveal>
      <Reveal className="rooms-calendar-column">
        <p className="section-kicker">Make yourself at home</p>
        <h2>Check your room availability<br />on this calendar.</h2>
        <HomeAvailabilityCheck variant="calendar" />
      </Reveal>
    </section>
  )
}
