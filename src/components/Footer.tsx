import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { GOOGLE_MAPS_URL, HOTEL_NAME, HOTEL_ADDRESS, HOTEL_PHONE_DISPLAY, HOTEL_PHONE_TEL, HOTEL_EMAIL, HOTEL_INSTAGRAM_URL } from '@/lib/siteConfig'

export default function Footer() {
  return (
    <footer className="guest-footer">
      <div className="guest-footer-grid">
        <div className="footer-story"><Link href="/" className="footer-wordmark">TAVERN<span>RESIDENCE</span></Link><p>A little more room. A little more comfort. Your apartment hotel in the heart of Lekki Phase 1, Lagos.</p><a href={GOOGLE_MAPS_URL} target="_blank" rel="noopener noreferrer" className="footer-location">{HOTEL_ADDRESS}<ArrowUpRight size={16} aria-hidden="true" /></a></div>
        <div><h2>Explore</h2><Link href="/rooms">Our rooms</Link><Link href="/#facilities">Facilities</Link><Link href="/#dining">Dining</Link><Link href="/#gallery">The residence</Link></div>
        <div><h2>Your stay</h2><Link href="/manage-booking">Manage booking</Link><Link href="/policies">Guest policies</Link><Link href="/contact">Contact us</Link><p className="footer-times">Check-in &middot; 2:00 PM<br />Check-out &middot; 12:00 PM</p></div>
        <div><h2>Keep in touch</h2><a href={`tel:${HOTEL_PHONE_TEL}`}>{HOTEL_PHONE_DISPLAY}</a><a href={`mailto:${HOTEL_EMAIL}`}>{HOTEL_EMAIL}</a><a href={HOTEL_INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">Instagram <ArrowUpRight size={13} aria-hidden="true" /></a></div>
      </div>
      <div className="guest-footer-bottom"><p>&copy; {new Date().getFullYear()} {HOTEL_NAME}. All rights reserved.</p><p>Your own little place in Lagos.</p></div>
    </footer>
  )
}
