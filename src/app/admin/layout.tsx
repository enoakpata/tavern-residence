import Link from 'next/link'
import { signOut } from './actions'
import NotificationBell from './NotificationBell'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ivory">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b-4 border-brass bg-charcoal px-6 py-4 text-ivory md:px-12">
        <div className="flex items-center gap-3">
          <Link href="/admin/bookings" className="font-display text-lg">
            Tavern Residence
          </Link>
          <span className="rounded-full border border-brass/50 px-2 py-0.5 text-[10px] font-semibold tracking-[0.2em] text-brass uppercase">
            Admin
          </span>
        </div>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/admin/check-in/check-out" className="hover:text-brass">
            Check-ins / Check-outs
          </Link>
          <Link href="/admin/bookings" className="hover:text-brass">
            Bookings
          </Link>
          <Link href="/admin/bookings/new" className="hover:text-brass">
            New booking
          </Link>
          <Link href="/admin/calendar" className="hover:text-brass">
            Calendar
          </Link>
          <NotificationBell />
          <form action={signOut}>
            <button type="submit" className="text-ivory/60 hover:text-brass">
              Sign out
            </button>
          </form>
        </nav>
      </header>
      {children}
    </div>
  )
}
