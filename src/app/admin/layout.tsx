import Link from 'next/link'
import { signOut } from './actions'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ivory">
      <header className="flex items-center justify-between border-b border-charcoal/10 bg-charcoal px-6 py-4 text-ivory md:px-12">
        <Link href="/admin/bookings" className="font-display text-lg">
          Tavern Residence — Admin
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/admin/bookings" className="hover:text-brass">
            Bookings
          </Link>
          <Link href="/admin/bookings/new" className="hover:text-brass">
            New booking
          </Link>
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
