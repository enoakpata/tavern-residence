import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact | Tavern Residence',
  description:
    'Reach Tavern Residence at No 20 Dele Adedeji, Lekki Phase 1, Lagos — call or WhatsApp 0701 583 2637, or email tavernresidence@gmail.com.',
}

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 md:px-12 md:py-28">
      <p className="text-xs tracking-widest text-brass uppercase">
        Get in touch
      </p>
      <h1 className="mt-3 font-display text-4xl text-charcoal md:text-5xl">
        Contact
      </h1>
      <p className="mt-4 text-charcoal/70">
        Questions about a booking, or planning a walk-in? Reach us directly —
        we usually respond fastest on WhatsApp.
      </p>

      <div className="mt-12 grid gap-8 sm:grid-cols-2">
        <div className="border-t border-charcoal/10 pt-6">
          <p className="text-xs tracking-widest text-brass uppercase">
            Phone / WhatsApp
          </p>
          <a
            href="tel:+2347015832637"
            className="mt-2 block text-lg text-charcoal hover:text-verdant"
          >
            0701 583 2637
          </a>
        </div>

        <div className="border-t border-charcoal/10 pt-6">
          <p className="text-xs tracking-widest text-brass uppercase">
            Email
          </p>
          <a
            href="mailto:tavernresidence@gmail.com"
            className="mt-2 block text-lg text-charcoal hover:text-verdant"
          >
            tavernresidence@gmail.com
          </a>
        </div>

        <div className="border-t border-charcoal/10 pt-6">
          <p className="text-xs tracking-widest text-brass uppercase">
            Instagram
          </p>
          <a
            href="https://www.instagram.com/tavernresidencelekki"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block text-lg text-charcoal hover:text-verdant"
          >
            @tavernresidencelekki
          </a>
        </div>

        <div className="border-t border-charcoal/10 pt-6">
          <p className="text-xs tracking-widest text-brass uppercase">
            Address
          </p>
          <p className="mt-2 text-lg text-charcoal">
            No 20 Dele Adedeji, Lekki Phase 1, Lagos
          </p>
        </div>
      </div>
    </main>
  )
}
