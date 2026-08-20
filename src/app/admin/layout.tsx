'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signOut } from './actions'
import NotificationBell from './NotificationBell'

const NAV_LINKS = [
  { href: '/admin/check-in/check-out', label: 'Check-ins / Check-outs' },
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/bookings/new', label: 'New booking' },
  { href: '/admin/calendar', label: 'Calendar' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen bg-ivory">
      <header className="sticky top-0 z-50 border-b-4 border-brass bg-charcoal px-6 py-4 text-ivory md:px-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/bookings"
              onClick={() => setOpen(false)}
              className="font-display text-lg"
            >
              Tavern Residence
            </Link>
            <span className="rounded-full border border-brass/50 px-2 py-0.5 text-[10px] font-semibold tracking-[0.2em] text-brass uppercase">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-4">
            <nav className="hidden items-center gap-6 text-sm md:flex">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="hover:text-brass">
                  {link.label}
                </Link>
              ))}
              <form action={signOut}>
                <button type="submit" className="text-ivory/60 hover:text-brass">
                  Sign out
                </button>
              </form>
            </nav>

            <NotificationBell />

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
        </div>

        <div
          className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out md:hidden ${
            open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <nav className="flex flex-col gap-1 overflow-hidden text-sm">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="border-t border-ivory/10 py-4 text-ivory/90 transition-colors hover:text-brass"
              >
                {link.label}
              </Link>
            ))}
            <form action={signOut} className="border-t border-ivory/10 py-4">
              <button type="submit" className="text-ivory/60 hover:text-brass">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      {children}
    </div>
  )
}
