import { AtSign, Mail, Phone } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-verdant px-6 py-16 text-ivory md:px-12">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-3">
        <div>
          <p className="font-display text-2xl">Tavern Residence</p>
          <p className="mt-4 text-sm leading-relaxed text-ivory/70">
            No 20 Dele Adedeji
            <br />
            Lekki Phase 1, Lagos
          </p>
        </div>

        <div className="text-sm text-ivory/70">
          <p className="mb-3 text-xs tracking-widest text-brass uppercase">
            Reach us
          </p>
          <p>
            <a
              href="tel:+2347015832637"
              className="flex items-center gap-2 hover:text-ivory"
            >
              <Phone size={16} className="text-brass" />
              0701 583 2637
            </a>
          </p>
          <p className="mt-1">
            <a
              href="mailto:tavernresidence@gmail.com"
              className="flex items-center gap-2 hover:text-ivory"
            >
              <Mail size={16} className="text-brass" />
              tavernresidence@gmail.com
            </a>
          </p>
          <p className="mt-1">
            <a
              href="https://www.instagram.com/tavernresidencelekki"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-ivory"
            >
              <AtSign size={16} className="text-brass" />
              @tavernresidencelekki
            </a>
          </p>
        </div>

        <div className="text-sm text-ivory/70">
          <p className="mb-3 text-xs tracking-widest text-brass uppercase">
            Stay
          </p>
          <p>Check-in from 2:00 PM</p>
          <p className="mt-1">Check-out by 12:00 PM</p>
        </div>
      </div>

      <p className="mx-auto mt-16 max-w-6xl text-xs text-ivory/40">
        © {new Date().getFullYear()} Tavern Residence. All rights reserved.
      </p>
    </footer>
  )
}
