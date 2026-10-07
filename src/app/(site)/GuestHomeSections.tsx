import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, Coffee, Heart, Laptop, MapPin } from 'lucide-react'
import Reveal from '@/components/Reveal'
import ScrollScene from '@/components/ScrollScene'
import { HOTEL_ADDRESS_LOCALITY } from '@/lib/siteConfig'

const facilities = [
  { name: 'Room to unwind', image: '/images/gallery/16.jpg', detail: 'Living spaces', alt: 'A lounge with a sofa and kitchenette at Tavern Residence' },
  { name: 'Stay connected', image: '/images/gallery/13.jpg', detail: 'Free Wi-Fi', alt: 'A quiet seating area at Tavern Residence' },
  { name: 'Make yourself at home', image: '/images/gallery/15.jpg', detail: 'Dry kitchenettes', alt: 'A dry kitchenette with a microwave and kettle' },
  { name: 'A little everyday luxury', image: '/images/gallery/11.jpg', detail: 'Ensuite bathrooms', alt: 'An ensuite bathroom with a stone countertop and mirror' },
  { name: 'Rest comes naturally', image: '/images/gallery/14.jpg', detail: 'King-size beds', alt: 'A king-size bed with fresh white linens' },
]

export function FacilitiesSection() {
  return (
    <section id="facilities" className="home-section facilities-section">
      <Reveal className="section-heading-row">
        <p className="section-description">The little details that make a difference.<br />Space to settle in. Comfort to come back to.</p>
        <div><p className="section-kicker">Premier facilities & guest services</p><h2 className="section-title">Everything<br />you need.</h2></div>
      </Reveal>
      <ScrollScene className="facilities-scene">
        <div className="facilities-sticky">
          <div className="facilities-track">
            {facilities.map((facility, index) => (
              <Link key={facility.detail} href="/rooms" className={`facility-card facility-card-${index}`}>
                <Image src={facility.image} alt={facility.alt} fill sizes="(min-width: 900px) 22vw, 65vw" className="scene-image object-cover" />
                <div className="photo-shade" />
                <span className="facility-number">0{index + 1}</span>
                <div className="facility-caption"><span>{facility.name}</span><h3>{facility.detail}</h3><ArrowUpRight size={20} aria-hidden="true" /></div>
              </Link>
            ))}
          </div>
          <div className="facilities-bottom"><Link href="/rooms" className="outline-pill">Explore the rooms <ArrowUpRight size={17} aria-hidden="true" /></Link><p>Thoughtfully equipped. Effortlessly comfortable.</p></div>
        </div>
      </ScrollScene>
    </section>
  )
}

export function DiningSection() {
  return (
    <section id="dining" className="home-section dining-section">
      <ScrollScene className="dining-scene">
        <div className="dining-photo">
          <Image src="/images/gallery/24.jpg" alt="The kitchenette at Tavern Residence, with a kettle and sink" fill sizes="(min-width: 900px) 55vw, 100vw" className="scene-image object-cover" />
          <span className="image-note"><Coffee size={16} aria-hidden="true" /> Slow mornings start here.</span>
        </div>
        <Reveal className="dining-copy">
          <p className="section-kicker">Dining at the Residence</p>
          <h2 className="section-title">Cooking worth<br />coming down for.</h2>
          <p>Good food. A slower morning. One less thing to think about.</p>
          <p>Our in-house chef is available for meals during your stay. Order from the QR code menu in your room, then settle in and let us take care of the cooking.</p>
          <p className="dining-note">Meals are charged separately from your room rate.</p>
          <Link href="/contact" className="outline-pill">Ask about dining <span className="pill-icon"><ArrowUpRight size={17} aria-hidden="true" /></span></Link>
        </Reveal>
      </ScrollScene>
    </section>
  )
}

const stayStyles = [
  { icon: Laptop, label: 'For the work trip', title: 'Your plans. Your pace.', description: 'Stay connected with free Wi-Fi, then switch off in the comfort of your own room.', detail: 'Work, then unwind.' },
  { icon: Heart, label: 'For a little time together', title: 'Make room for the two of you.', description: 'A king-size bed, a private ensuite, and a quiet space to enjoy being away together.', detail: 'A softer kind of getaway.' },
  { icon: MapPin, label: `For exploring ${HOTEL_ADDRESS_LOCALITY}`, title: 'A local place to come home to.', description: 'Start with the neighbourhood. End with your feet up in a space that feels familiar.', detail: 'Stay in the heart of Lekki.' },
  { icon: Coffee, label: 'For the longer stay', title: 'Settle into your own rhythm.', description: 'Choose a Studio or 1-Bedroom apartment for a dry kitchenette and a little more room.', detail: 'More than a place to sleep.' },
]

export function StayStylesSection() {
  return (
    <section className="stay-styles-section home-section">
      <Reveal className="stay-styles-heading"><p className="section-kicker">However you like to stay</p><h2 className="section-title">A stay that feels like you.</h2><p>A weekend away, a working week, or a little longer.<br />There is a room for your kind of visit.</p></Reveal>
      <div className="stay-styles-track">
        {stayStyles.map((style) => {
          const Icon = style.icon
          return <Reveal key={style.label} className="stay-style-card"><p className="stay-style-label">{style.label}</p><Icon size={27} strokeWidth={1.2} aria-hidden="true" /><h3>{style.title}</h3><p>{style.description}</p><Link href="/rooms">{style.detail}<ArrowUpRight size={18} aria-hidden="true" /></Link></Reveal>
        })}
      </div>
    </section>
  )
}
