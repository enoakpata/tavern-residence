'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export default function Header() {
  const [open, setOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)

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

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 bg-verdant px-6 py-5 md:px-12 md:py-6"
    >
      <div className="flex items-center justify-between">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="font-display text-xl tracking-wide text-ivory md:text-2xl"
        >
          Tavern Residence
        </Link>

        <nav className="hidden items-center gap-6 text-sm tracking-wide text-ivory/90 md:flex md:gap-10">
          <Link href="/rooms" className="hover:text-brass transition-colors">
            Rooms
          </Link>
          <Link href="/policies">Policies</Link>
          <Link href="/contact" className="hover:text-brass transition-colors">
            Contact
          </Link>
          <Link href="/manage-booking" className="hover:text-brass transition-colors">
            My Booking
          </Link>
          <Link
            href="/rooms"
            className="rounded-full border border-ivory/40 px-4 py-2 hover:border-brass hover:text-brass transition-colors"
          >
            Book now
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center text-ivory md:hidden"
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

      <div
        className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out md:hidden ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <nav className="flex flex-col gap-1 overflow-hidden text-sm tracking-wide text-ivory/90">
          <Link
            href="/policies"
            onClick={() => setOpen(false)}
            className="border-t border-ivory/10 py-4"
          >
            Policies
          </Link>
          <Link
            href="/rooms"
            onClick={() => setOpen(false)}
            className="border-t border-ivory/10 py-4 hover:text-brass transition-colors"
          >
            Rooms
          </Link>
          <Link
            href="/contact"
            onClick={() => setOpen(false)}
            className="border-t border-ivory/10 py-4 hover:text-brass transition-colors"
          >
            Contact
          </Link>
          <Link
            href="/manage-booking"
            onClick={() => setOpen(false)}
            className="border-t border-ivory/10 py-4 hover:text-brass transition-colors"
          >
            My Booking
          </Link>
          <Link
            href="/rooms"
            onClick={() => setOpen(false)}
            className="my-4 rounded-full border border-ivory/40 px-4 py-3 text-center hover:border-brass hover:text-brass transition-colors"
          >
            Book now
          </Link>
        </nav>
      </div>
    </header>
  )
}
