'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HOTEL_NAME } from '@/lib/siteConfig'

export default function Header() {
  const [open, setOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const pathname = usePathname()

  // Only the homepage has a full-bleed hero for the header to float over
  // transparently — every other page starts directly under the header
  // with no dark hero image behind it, so white nav text there would be
  // unreadable against that page's own cream background if left
  // transparent. Solid everywhere else, from the very first frame.
  const isHome = pathname === '/'
  const [scrolled, setScrolled] = useState(false)
  const transparent = isHome && !scrolled

  useEffect(() => {
    if (!isHome) return
    function handleScroll() {
      setScrolled(window.scrollY > 40)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isHome])

  // Mirrors the outside-click-closes pattern in DateRangePicker.tsx.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Also close when the guest starts scrolling — listening for 'wheel'
  // and 'touchmove' (the actual user gestures) rather than 'scroll' (the
  // resulting position change) is deliberate: focusing the hamburger
  // button while the page is already scrolled triggers the browser's own
  // focus-into-view scroll animation on a sticky-positioned header, which
  // fires genuine 'scroll' events with no user input involved — that
  // self-inflicted scroll would otherwise close the menu the instant it
  // opens. Wheel/touchmove can only originate from the guest.
  useEffect(() => {
    if (!open) return
    function handleUserScroll() {
      setOpen(false)
    }
    window.addEventListener('wheel', handleUserScroll, { passive: true })
    window.addEventListener('touchmove', handleUserScroll, { passive: true })
    return () => {
      window.removeEventListener('wheel', handleUserScroll)
      window.removeEventListener('touchmove', handleUserScroll)
    }
  }, [open])

  // Letter-spaced sans-serif labels with a brass underline that grows in
  // on hover — one shared class string so every nav link (this component
  // is the only place that needs it) stays identical. Brass here is the
  // "rare accent" — a thin 1px hover line, never a fill.
  const navLinkClasses =
    'relative pb-1 tracking-widest uppercase after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-brass after:transition-transform after:duration-base hover:after:scale-x-100'

  return (
    // Fixed (not sticky) and out of document flow everywhere, with an
    // exact h-16/h-20 row height — see (site)/layout.tsx's matching
    // pt-16/pt-20 and the homepage hero's matching -mt-16/-mt-20. All
    // three share the same literal Tailwind spacing tokens, so the
    // compensation is always exact regardless of viewport size or how
    // tall the header's own content happens to render. Keep all three in
    // sync if this height ever changes again.
    <header
      ref={headerRef}
      className={`fixed inset-x-0 top-0 z-50 px-6 transition-colors duration-base md:px-12 ${
        transparent
          ? 'bg-transparent text-white'
          : 'border-b border-charcoal/10 bg-ivory text-charcoal'
      }`}
    >
      <div className="flex h-16 items-center justify-between md:h-20">
        {/* Wordmark only — no tagline line beneath it. Title case, not
            all-caps: Fraunces' distinctive high-contrast serif character
            (the whole reason it was picked) reads much more clearly in
            mixed case than flattened into caps. */}
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="font-display text-xl tracking-wide md:text-2xl"
        >
          {HOTEL_NAME}
        </Link>

        <nav className="hidden items-center gap-8 text-xs md:flex md:gap-10">
          <Link href="/rooms" className={navLinkClasses}>
            Rooms
          </Link>
          <Link href="/policies" className={navLinkClasses}>
            Policies
          </Link>
          <Link href="/contact" className={navLinkClasses}>
            Contact
          </Link>
          <Link href="/manage-booking" className={navLinkClasses}>
            My Booking
          </Link>
          <Link
            href="/rooms"
            className="rounded-full bg-verdant px-5 py-2.5 tracking-widest text-white uppercase transition-colors duration-base hover:bg-verdant/90"
          >
            Book now
          </Link>
        </nav>

        {/* Green pill stays visible next to the hamburger on mobile too —
            "collapses to a hamburger with the green pill button still
            visible" is the explicit requirement, not folded into the
            hamburger menu. */}
        <div className="flex items-center gap-3 md:hidden">
          <Link
            href="/rooms"
            className="rounded-full bg-verdant px-4 py-2 text-[11px] tracking-widest text-white uppercase transition-colors duration-base hover:bg-verdant/90"
          >
            Book now
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            >
              {open ? (
                <>
                  <line x1="5" y1="5" x2="19" y2="19" />
                  <line x1="19" y1="5" x2="5" y2="19" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Solid regardless of the header's own transparent/scrolled state —
          once open, this reads as its own panel rather than blending into
          a hero photo behind it. */}
      <div
        className={`grid overflow-hidden bg-ivory text-charcoal transition-[grid-template-rows] duration-300 ease-in-out md:hidden ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <nav className="flex flex-col gap-1 overflow-hidden text-sm tracking-widest uppercase">
          <Link
            href="/policies"
            onClick={() => setOpen(false)}
            className="border-t border-charcoal/10 py-4"
          >
            Policies
          </Link>
          <Link
            href="/rooms"
            onClick={() => setOpen(false)}
            className="border-t border-charcoal/10 py-4 transition-colors duration-base hover:text-brass"
          >
            Rooms
          </Link>
          <Link
            href="/contact"
            onClick={() => setOpen(false)}
            className="border-t border-charcoal/10 py-4 transition-colors duration-base hover:text-brass"
          >
            Contact
          </Link>
          <Link
            href="/manage-booking"
            onClick={() => setOpen(false)}
            className="border-t border-charcoal/10 py-4 transition-colors duration-base hover:text-brass"
          >
            My Booking
          </Link>
        </nav>
      </div>
    </header>
  )
}
