import Link from 'next/link'

export default function Header() {
  return (
    <header>
      {/* TODO: real nav design — this is just placeholder structure */}
      <Link href="/">Tavern Residence</Link>
      <nav>
        <Link href="/rooms">Rooms</Link>
        <Link href="/contact">Contact</Link>
      </nav>
    </header>
  )
}
