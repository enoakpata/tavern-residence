import Link from 'next/link'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between bg-verdant px-6 py-5 md:px-12 md:py-6">
      <Link
        href="/"
        className="font-display text-xl tracking-wide text-ivory md:text-2xl"
      >
        Tavern Residence
      </Link>
      <nav className="flex items-center gap-6 text-sm tracking-wide text-ivory/90 md:gap-10">
        <Link href="/policies">Policies</Link>
        <Link href="/rooms" className="hover:text-brass transition-colors">
          Rooms
        </Link>
        <Link href="/contact" className="hover:text-brass transition-colors">
          Contact
        </Link>
        <Link
          href="/rooms"
          className="rounded-full border border-ivory/40 px-4 py-2 hover:border-brass hover:text-brass transition-colors"
        >
          Book now
        </Link>
      </nav>
    </header>
  )
}
