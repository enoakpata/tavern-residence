import Link from 'next/link'
import { Mail, Phone } from 'lucide-react'
import { FaInstagram } from 'react-icons/fa6'
import { HOTEL_NAME, HOTEL_PHONE_TEL, HOTEL_EMAIL, HOTEL_INSTAGRAM_URL } from '@/lib/siteConfig'

export default function Footer() {
  return <footer className="guest-footer"><div className="footer-main"><Link href="/" className="footer-wordmark">Tavern Residence</Link><nav aria-label="Footer navigation"><Link href="/#overview">Home</Link><Link href="/#gallery">Gallery</Link><Link href="/rooms">Rooms</Link><Link href="/#facilities">Amenities</Link></nav><div className="footer-social"><a href={HOTEL_INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="Tavern Residence on Instagram"><FaInstagram size={17} /></a><a href={'mailto:' + HOTEL_EMAIL} aria-label="Email Tavern Residence"><Mail size={17} /></a><a href={'tel:' + HOTEL_PHONE_TEL} aria-label="Call Tavern Residence"><Phone size={17} /></a></div></div><div className="guest-footer-bottom"><p>&copy; {new Date().getFullYear()} {HOTEL_NAME}. All rights reserved.</p><nav aria-label="Guest information"><Link href="/manage-booking">Manage booking</Link><Link href="/policies">Guest policies</Link><Link href="/contact">Contact us</Link></nav></div></footer>
}
