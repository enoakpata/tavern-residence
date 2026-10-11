import Image from 'next/image'
import Link from 'next/link'
import { BedDouble, ChefHat, Coffee, ChevronRight, Mail, MapPin, Phone, Sofa, Wifi, ConciergeBell, Utensils } from 'lucide-react'
import { GOOGLE_MAPS_URL, HOTEL_ADDRESS, HOTEL_EMAIL, HOTEL_PHONE_DISPLAY, HOTEL_PHONE_TEL } from '@/lib/siteConfig'

export function WelcomeSection() {
  return <section id="overview" className="home-section welcome-section editorial-heading"><p className="eyebrow">WELCOME TO TAVERN RESIDENCE</p><h2>Indulge in Comfort. Embrace the Ease.{' '}<br />Your Retreat, Your Everyday.</h2><p>Discover a little more room to feel at home in Lekki Phase 1, Lagos. Thoughtfully appointed rooms, modern comforts, and a warm welcome come together for a stay that fits your rhythm — whether you are here for business, a weekend away, or a little longer.</p></section>
}

const facilities = [
  { icon: Utensils, title: 'Dining Options', detail: 'Our in-house chef, at your service', href: '#dining' },
  { icon: Sofa, title: 'Spaces to Unwind', detail: 'Comfortable living, at your pace', href: '#comfort' },
  { icon: BedDouble, title: 'Restful Rooms', detail: 'King-size beds and private ensuites', href: '/rooms' },
  { icon: ConciergeBell, title: 'Guest Services', detail: 'A warm welcome throughout your stay', href: '/contact' },
  { icon: Wifi, title: 'Work & Stay', detail: 'Free Wi-Fi and space to settle in', href: '#experiences' },
]
export function FacilitiesSection() {
  return <section id="facilities" className="home-section facilities-section"><div className="editorial-heading"><p className="eyebrow">THOUGHTFULLY DESIGNED SPACES FOR MODERN LIVING</p><h2>Featured Amenities On-Site</h2></div><div className="amenity-grid">{facilities.map((item, index) => { const Icon = item.icon; return <Link className={'amenity-tile' + (index === 0 ? ' amenity-featured' : '')} key={item.title} href={item.href}><Icon size={23} strokeWidth={1.2} aria-hidden="true" /><h3>{item.title}</h3><p>{item.detail}</p><ChevronRight className="amenity-arrow" size={16} aria-hidden="true" /></Link> })}</div><div className="center-link"><Link href="/rooms" className="text-link">View room amenities <ChevronRight size={14} aria-hidden="true" /></Link></div></section>
}

export function DiningSection() {
  return <section id="dining" className="home-section dining-section"><div className="dining-panel"><div className="editorial-heading dining-copy"><p className="eyebrow">DINING AT THE RESIDENCE</p><h2>A Taste of Home</h2><p>Good food, a slower morning, and one less thing to think about. Our in-house chef is available for meals during your stay. Order from the QR code menu in your room, then settle in and let us take care of the cooking.</p><p className="dining-note">Meals are charged separately from your room rate.</p><Link href="/contact" className="text-link">Learn more <ChevronRight size={14} aria-hidden="true" /></Link></div><div className="dining-photo"><Image src="/images/gallery/24.jpg" alt="The kitchenette at Tavern Residence with a kettle and sink" fill sizes="(min-width: 768px) 80vw, 100vw" className="object-cover" /></div></div></section>
}

const comforts = [
  { label: 'UNWIND', title: 'A Little More Living Space', description: 'Make yourself comfortable in a one-bedroom apartment with a separate living area. Room to relax, read, and enjoy the slower moments of your stay.', image: '/images/gallery/16.jpg', alt: 'A comfortable sofa and living space at Tavern Residence' },
  { label: 'REST', title: 'Your Everyday Escape', description: 'A king-size bed, fresh surroundings, and a private ensuite. Find a peaceful place to recharge after a working day or an afternoon exploring Lagos.', image: '/images/104/room_104.jpg', alt: 'A thoughtfully furnished Standard Room at Tavern Residence' },
  { label: 'SETTLE IN', title: 'At Home, Away From Home', description: 'Choose a Studio or one-bedroom apartment for a dry kitchenette and the freedom to keep things simple. A cup of tea, a light meal, and your own daily rhythm.', image: '/images/gallery/15.jpg', alt: 'A dry kitchenette with a kettle and microwave at Tavern Residence' },
]
export function ComfortSection() {
  return <section id="comfort" className="home-section comfort-section"><div className="editorial-heading"><h2>More Ways to Enjoy Your Stay</h2></div><div className="comfort-list">{comforts.map(item => <article className="comfort-row" key={item.title}><div className="comfort-copy"><p className="eyebrow">{item.label}</p><h3>{item.title}</h3><p>{item.description}</p><Link href="/rooms" className="text-link">Learn more <ChevronRight size={14} aria-hidden="true" /></Link></div><div className="comfort-photo"><Image src={item.image} alt={item.alt} fill sizes="(min-width: 768px) 40vw, 90vw" className="object-cover" /></div></article>)}</div></section>
}

const experiences = [
  { icon: ChefHat, title: 'Dining, Made Simple', description: 'Enjoy a meal prepared by our in-house chef. Scan the menu in your room and leave the cooking to us.', image: '/images/gallery/24.jpg', alt: 'A bright kitchenette at the residence', href: '#dining' },
  { icon: Coffee, title: 'The Slow Morning', description: 'Wake up in your own quiet space. A comfortable bed, a cup of tea, and a little time to yourself.', image: '/images/gallery/14.jpg', alt: 'A king-size bed with fresh white bedding', href: '/rooms' },
  { icon: MapPin, title: 'Discover Lekki', description: 'A welcoming base in Lekki Phase 1. Step out into the neighbourhood, then come home to familiar comforts.', image: '/images/gallery/10.jpg', alt: 'Contemporary artwork and interior details at Tavern Residence', href: '/contact' },
]
export function StayStylesSection() {
  return <section id="experiences" className="home-section experiences-section"><div className="editorial-heading"><p className="eyebrow">EXPERIENCE</p></div><div className="experience-grid">{experiences.map(item => <article className="experience-card" key={item.title}><div className="experience-photo"><Image src={item.image} alt={item.alt} fill sizes="(min-width: 768px) 27vw, 90vw" className="object-cover" /></div><div className="experience-copy"><h3>{item.title}</h3><p>{item.description}</p><Link className="text-link" href={item.href}>Learn more <ChevronRight size={14} aria-hidden="true" /></Link></div></article>)}</div><div className="center-link"><Link href="/rooms" className="text-link">Discover your stay <ChevronRight size={14} aria-hidden="true" /></Link></div></section>
}

export function BookingInvitation() {
  return <section className="home-section booking-invitation"><h2>Book Your Stay<br />Discover the Experience</h2><p>A stay defined by comfort, thoughtful details, and the freedom to feel at home.<br />Experience Tavern Residence at its best.</p><Link href="/rooms" className="quiet-button">View rooms</Link></section>
}

export function GettingHereSection() {
  return <section className="home-section getting-here"><div className="getting-here-copy"><p className="eyebrow">OUR LOCATION</p><h2>Getting Here</h2><a href={'mailto:' + HOTEL_EMAIL}><Mail size={16} aria-hidden="true" />{HOTEL_EMAIL}</a><a href={'tel:' + HOTEL_PHONE_TEL}><Phone size={16} aria-hidden="true" />{HOTEL_PHONE_DISPLAY}</a><a href={GOOGLE_MAPS_URL} target="_blank" rel="noopener noreferrer"><MapPin size={17} aria-hidden="true" /><span>Tavern Residence<br />{HOTEL_ADDRESS}</span></a><a className="text-link" href={GOOGLE_MAPS_URL} target="_blank" rel="noopener noreferrer">Get directions <ChevronRight size={14} aria-hidden="true" /></a></div><div className="location-map"><iframe title="Tavern Residence location in Lekki Phase 1, Lagos" src={'https://maps.google.com/maps?q=' + encodeURIComponent('Tavern Residence, ' + HOTEL_ADDRESS) + '&t=&z=15&ie=UTF8&iwloc=&output=embed'} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div></section>
}
