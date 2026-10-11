'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const stories = [
  { image: '/images/gallery/16.jpg', title: 'A place of your own', label: 'THE TAVERN RESIDENCE', description: 'A welcoming apartment hotel in the heart of Lekki. Settle into thoughtfully furnished spaces, discover the details that make everyday life easier, and enjoy the freedom to stay at your own pace.' },
  { image: '/images/gallery/10.jpg', title: 'Thoughtful by design', label: 'DETAILS OF THE RESIDENCE', description: 'Warm lighting, contemporary interiors, and a little local character. Our spaces bring familiar comforts together with the pleasure of being somewhere new.' },
  { image: '/images/gallery/19.jpg', title: 'Time to settle in', label: 'YOUR HOME IN LEKKI', description: 'For a weekend, a working week, or a longer escape. Find a room to rest, a place to unwind, and an easy base for discovering Lagos.' },
]
export default function ResidenceStories() {
  const [index, setIndex] = useState(0)
  const story = stories[index]
  return <section className="home-section stories-section">
    <div className="stories-heading"><h2>Our Stories</h2><a href="#gallery" className="text-link">View the gallery <ChevronRight size={14} aria-hidden="true" /></a></div>
    <div className="stories-layout">
      <article className="story-feature"><div className="story-photo"><Image src={story.image} alt="A welcoming interior at Tavern Residence" fill sizes="(min-width: 768px) 37vw, 90vw" className="object-cover" /></div><div className="story-copy"><p className="eyebrow">{story.label}</p><h3>{story.title}</h3><p>{story.description}</p><Link href="/rooms" className="text-link">Explore Tavern Residence <ChevronRight size={14} aria-hidden="true" /></Link></div></article>
      <div className="story-secondary"><Image src={stories[(index + 1) % stories.length].image} alt="Artwork and warm interiors at the residence" fill sizes="30vw" className="object-cover" /></div>
      <div className="story-third"><Image src={stories[(index + 2) % stories.length].image} alt="A comfortable living area at Tavern Residence" fill sizes="30vw" className="object-cover" /></div>
    </div>
    <div className="story-pagination"><div className="slider-dots">{stories.map((item, i) => <button key={item.title} className={index === i ? 'active' : ''} onClick={() => setIndex(i)} aria-label={'Read story ' + (i + 1)} aria-pressed={index === i} />)}</div><div className="carousel-controls"><button onClick={() => setIndex((index + stories.length - 1) % stories.length)} aria-label="Previous story"><ChevronLeft size={17} /></button><button onClick={() => setIndex((index + 1) % stories.length)} aria-label="Next story"><ChevronRight size={17} /></button></div></div>
  </section>
}
