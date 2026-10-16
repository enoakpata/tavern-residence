import Link from 'next/link'
import { ChefHat, ChevronRight, CookingPot, Mail, MapPin, ParkingCircle, Phone, Wifi } from 'lucide-react'
import { FaInstagram } from 'react-icons/fa6'
import {
  GOOGLE_MAPS_URL,
  HOTEL_ADDRESS,
  HOTEL_EMAIL,
  HOTEL_INSTAGRAM_HANDLE,
  HOTEL_INSTAGRAM_URL,
  HOTEL_PHONE_DISPLAY,
  HOTEL_PHONE_TEL,
} from '@/lib/siteConfig'

// Trimmed to exactly 4 concise amenity labels (previously 5 tiles with a
// title + descriptive subtitle each, which read as wordy) — single
// icon+label tile, no link/href, since none of these map to a specific
// page the way the old tiles' hrefs did.
const facilities = [
  { icon: ChefHat, label: 'In-house chef' },
  { icon: CookingPot, label: 'Dry kitchenette' },
  { icon: Wifi, label: 'Free Wi-Fi' },
  { icon: ParkingCircle, label: 'On-site parking' },
]
export function FacilitiesSection() {
  return <section id="facilities" className="home-section facilities-section"><div className="editorial-heading"><p className="eyebrow">THOUGHTFULLY DESIGNED SPACES FOR MODERN LIVING</p><h2>Featured Amenities On-Site</h2></div><div className="amenity-grid">{facilities.map((item) => { const Icon = item.icon; return <div className="amenity-tile" key={item.label}><Icon size={23} strokeWidth={1.2} aria-hidden="true" /><h3>{item.label}</h3></div> })}</div><div className="center-link"><Link href="/rooms" className="text-link">View room amenities <ChevronRight size={14} aria-hidden="true" /></Link></div></section>
}

export function BookingInvitation() {
  return <section className="home-section booking-invitation"><h2>Book Your Stay<br />Discover the Experience</h2><p>A stay defined by comfort, thoughtful details, and the freedom to feel at home.<br />Experience Tavern Residence at its best.</p><Link href="/rooms" className="quiet-button">View rooms</Link></section>
}

export function GettingHereSection() {
  return <section className="home-section getting-here"><div className="getting-here-copy"><p className="eyebrow">OUR LOCATION</p><h2>Getting Here</h2><a href={'mailto:' + HOTEL_EMAIL}><Mail size={16} aria-hidden="true" />{HOTEL_EMAIL}</a><a href={'tel:' + HOTEL_PHONE_TEL}><Phone size={16} aria-hidden="true" />{HOTEL_PHONE_DISPLAY}</a><a href={HOTEL_INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"><FaInstagram size={16} aria-hidden="true" />{HOTEL_INSTAGRAM_HANDLE}</a><a href={GOOGLE_MAPS_URL} target="_blank" rel="noopener noreferrer"><MapPin size={17} aria-hidden="true" /><span>Tavern Residence<br />{HOTEL_ADDRESS}</span></a><a className="text-link" href={GOOGLE_MAPS_URL} target="_blank" rel="noopener noreferrer">Get directions <ChevronRight size={14} aria-hidden="true" /></a></div><div className="location-map"><iframe title="Tavern Residence location in Lekki Phase 1, Lagos" src={'https://maps.google.com/maps?q=' + encodeURIComponent('Tavern Residence, ' + HOTEL_ADDRESS) + '&t=&z=15&ie=UTF8&iwloc=&output=embed'} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div></section>
}
