'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import GalleryLightbox from '@/components/GalleryLightbox'

export default function AroundTheResidence({ images }: { images: string[] }) {
  const track = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  if (!images.length) return null
  function show(index: number) {
    const element = track.current
    if (!element) return
    const next = (index + images.length) % images.length
    const card = element.children[next] as HTMLElement | undefined
    if (card) element.scrollTo({ left: card.offsetLeft - element.offsetLeft, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  return <section id="gallery" className="home-section residence-gallery-section">
    <div className="editorial-heading"><p className="eyebrow">SPACE TO MAKE YOUR OWN</p><h2>Life at the Residence</h2><p>Warm interiors, thoughtful details, and familiar comforts. Take a closer look at the spaces that make Tavern Residence a welcoming place for business trips, weekends away, and longer stays.</p><button className="quiet-button" onClick={() => setOpenIndex(active)}>Discover the residence</button></div>
    <div className="residence-carousel"><div ref={track} className="residence-photo-track" tabIndex={0} aria-label="Residence photo gallery" onScroll={() => { const element = track.current; if (element) setActive(Math.min(images.length - 1, Math.round(element.scrollLeft / (((element.firstElementChild as HTMLElement)?.offsetWidth ?? 0) + 24)))) }}>{images.map((src, index) => <button className="residence-photo" key={src} onClick={() => setOpenIndex(index)} aria-label={'Enlarge residence photo ' + (index + 1)}><Image src={src} alt={'Interior detail ' + (index + 1) + ' at Tavern Residence'} fill sizes="(min-width: 768px) 80vw, 90vw" className="object-cover" /></button>)}</div><button className="slider-arrow previous" onClick={() => show(active - 1)} aria-label="Previous residence photo"><ChevronLeft size={20} /></button><button className="slider-arrow next" onClick={() => show(active + 1)} aria-label="Next residence photo"><ChevronRight size={20} /></button></div>
    <div className="gallery-pagination"><span>{String(active + 1).padStart(2, '0')}</span><div className="gallery-progress"><span style={{ width: ((active + 1) / images.length) * 100 + '%' }} /></div><span>{String(images.length).padStart(2, '0')}</span></div>
    {openIndex !== null && <GalleryLightbox photos={images.map(src => ({ src, caption: 'Residence interior' }))} index={openIndex} onClose={() => setOpenIndex(null)} onNavigate={setOpenIndex} />}
  </section>
}
