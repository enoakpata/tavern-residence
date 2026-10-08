"use client"

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import { HOTEL_NAME } from '@/lib/siteConfig'

const links = [
  { label: 'Home', href: '/' },
  { label: 'Rooms', href: '/rooms' },
  { label: 'Facilities', href: '/#facilities' },
  { label: 'Dining', href: '/#dining' },
  { label: 'Contact', href: '/contact' },
]

export default function Header() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const hasHero = pathname === '/' || pathname === '/rooms'
  const transparent = hasHero && !scrolled && !open

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 40)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const panel = menuRef.current
    if (!panel) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
      if (event.key !== 'Tab') return
      const links = Array.from(panel.querySelectorAll<HTMLElement>('a, button'))
        .filter((element) => element.getClientRects().length > 0)
      const first = links[0]
      const last = links[links.length - 1]
      if (!panel.contains(document.activeElement)) {
        event.preventDefault()
        first?.focus({ preventScroll: true })
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    const focusFrame = window.requestAnimationFrame(() => {
      panel.querySelector<HTMLElement>('[data-menu-close]')?.focus({ preventScroll: true })
    })
    const previousOverflow = document.body.style.overflow
    const desktop = window.matchMedia('(min-width: 900px)')
    function closeOnDesktop(event: MediaQueryListEvent) {
      if (event.matches) setOpen(false)
    }
    document.body.style.overflow = 'hidden'
    const background = Array.from(document.querySelectorAll<HTMLElement>('.guest-header, .site-content, .guest-footer'))
    const previousInert = background.map((element) => element.inert)
    background.forEach((element) => { element.inert = true })
    desktop.addEventListener('change', closeOnDesktop)
    document.addEventListener('keydown', handleKey)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
      background.forEach((element, index) => { element.inert = previousInert[index] })
      desktop.removeEventListener('change', closeOnDesktop)
      document.removeEventListener('keydown', handleKey)
      headerRef.current?.querySelector<HTMLElement>('.guest-menu-toggle')?.focus({ preventScroll: true })
    }
  }, [open])

  return (
    <>
    <header ref={headerRef} className={`guest-header ${transparent ? 'header-transparent' : 'header-solid'} ${open ? 'menu-open' : ''}`}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <div className="guest-header-row">
        <Link href="/" onClick={() => setOpen(false)} className="guest-wordmark" aria-label={`${HOTEL_NAME} home`}>
          TAVERN<span>RESIDENCE &middot; LEKKI</span>
        </Link>
        <nav className="guest-desktop-nav" aria-label="Main navigation">
          {links.map((link) => (
            <Link key={link.label} href={link.href} className={pathname === link.href ? 'nav-active' : ''} aria-current={pathname === link.href ? 'page' : undefined}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="guest-header-actions">
          <Link href="/rooms" className="header-booking">
            Booking <span><ArrowUpRight size={17} aria-hidden="true" /></span>
          </Link>
          <button type="button" onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="guest-mobile-menu" className="guest-menu-toggle">
            {open ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
      </div>
    </header>
    {/* A sibling avoids the blurred header becoming the fixed panel's containing block. */}
    <div
      ref={menuRef}
      id="guest-mobile-menu"
      className={`mobile-menu-panel ${open ? 'is-open' : ''}`}
      role="dialog"
      aria-modal={open || undefined}
      aria-labelledby="mobile-menu-title"
      aria-hidden={!open}
      inert={!open}
    >
      <h2 id="mobile-menu-title" className="sr-only">Site navigation</h2>
      <div className="mobile-menu-header">
        <Link href="/" onClick={() => setOpen(false)} className="guest-wordmark" aria-label={`${HOTEL_NAME} home`}>
          TAVERN<span>RESIDENCE &middot; LEKKI</span>
        </Link>
        <button type="button" data-menu-close onClick={() => setOpen(false)} className="mobile-menu-close" aria-label="Close menu">
          <X size={26} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <div className="mobile-menu-content">
        <p className="mobile-menu-eyebrow">Make yourself at home</p>
        <nav className="guest-mobile-nav" aria-label="Mobile navigation">
          {[...links, { label: 'My booking', href: '/manage-booking' }, { label: 'Policies', href: '/policies' }].map((link, index) => (
            <Link key={link.label} href={link.href} onClick={() => setOpen(false)} style={{ '--menu-item-index': index } as CSSProperties} aria-current={pathname === link.href ? 'page' : undefined}>
              <span className="mobile-nav-number">0{index + 1}</span>
              {link.label}
              <ArrowUpRight size={22} aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </div>
      <div className="mobile-menu-footer">
        <Link href="/rooms" onClick={() => setOpen(false)} className="mobile-booking-link">
          Find your room <span><ArrowUpRight size={22} aria-hidden="true" /></span>
        </Link>
        <p>Your own little place in Lekki, Lagos.</p>
      </div>
    </div>
    </>
  )
}
