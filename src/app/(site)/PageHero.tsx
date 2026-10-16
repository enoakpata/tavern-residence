import Image from 'next/image'
import Link from 'next/link'
import { ArrowDown } from 'lucide-react'
import HomeAvailabilityCheck from './HomeAvailabilityCheck'

/**
 * The one hero both the homepage and /rooms render — one markup tree,
 * one set of styles (guest.css's .page-hero and friends), no
 * page-specific CSS variant of any of it. The homepage's own look —
 * full-bleed, a fixed height, headline and bar absolutely overlaid on
 * the photo — is the reference, and /rooms uses the exact same rules.
 *
 * The only thing that differs between the two pages is what's inside
 * .hero-subline (itself inside .hero-headline, below the <h1>): the
 * homepage renders a <p> subtitle there, /rooms renders a
 * .hero-action-link button instead (optional `subtitle`/`action` props
 * below). .hero-subline is taken out of flow (CSS) so neither one
 * affects .hero-headline's own box — the title's vertical position is
 * driven by the <h1> alone and is identical on both pages regardless
 * of which sibling is present.
 */
export default function PageHero({
  image,
  title,
  subtitle,
  action,
  initialCheckIn = null,
  initialCheckOut = null,
  scrollToRoomsOnComplete = false,
}: {
  // null only if the gallery folder is genuinely empty (getGalleryImages
  // falls back through a couple of indices before giving up) — the hero
  // section itself (and the headline/bar below it) still render either
  // way, just without a photo.
  image: { src: string; alt: string } | null
  title: string
  // Only the homepage uses this today ("A stay to remember") — optional
  // so /rooms, which has none, doesn't render an empty <p>.
  subtitle?: string
  // Only /rooms uses this today ("Explore the collection", scrolls to
  // its own room list) — optional so the homepage doesn't get a button
  // it has nothing to link to.
  action?: { label: string; href: string }
  // Only /rooms passes these (dates already in the URL from a previous
  // search) — the homepage never has any.
  initialCheckIn?: string | null
  initialCheckOut?: string | null
  // /rooms only — see HomeAvailabilityCheck.tsx's own prop doc. Left
  // false for the homepage, whose bar keeps its existing click-the-button
  // behavior untouched.
  scrollToRoomsOnComplete?: boolean
}) {
  return (
    <section className="page-hero">
      {image && (
        <Image
          src={image.src}
          alt={image.alt}
          fill
          priority
          sizes="100vw"
          className="hero-photo object-cover"
        />
      )}
      <div className="hero-shade" />

      <div className="hero-headline">
        <h1>{title}</h1>
        {(subtitle || action) && (
          <div className="hero-subline">
            {subtitle && <p>{subtitle}</p>}
            {action && (
              <Link href={action.href} className="outline-pill hero-action-link">
                {action.label} <ArrowDown size={16} aria-hidden="true" />
              </Link>
            )}
          </div>
        )}
      </div>

      <div id="availability" className="hero-availability">
        <HomeAvailabilityCheck
          key={`${initialCheckIn}-${initialCheckOut}`}
          initialCheckIn={initialCheckIn}
          initialCheckOut={initialCheckOut}
          scrollToRoomsOnComplete={scrollToRoomsOnComplete}
        />
      </div>
    </section>
  )
}
