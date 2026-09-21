import { BedDouble, MapPin, Sparkles, ShieldCheck } from 'lucide-react'
import { HOTEL_ADDRESS_LOCALITY, HOTEL_ADDRESS_REGION } from '@/lib/siteConfig'

// Thin-line icons (lucide's default stroke), a bold short heading, and a
// muted one-line description — 4 columns, adapted to what's actually true
// for Tavern Residence rather than the reference's literal claims (no
// "no booking fees" / guarantee-style copy here — nothing fabricated).
const FEATURES = [
  {
    icon: BedDouble,
    heading: 'Well-Appointed Rooms',
    description: 'Thoughtfully furnished spaces designed for comfort.',
  },
  {
    icon: MapPin,
    heading: 'Prime Location',
    description: `In the heart of ${HOTEL_ADDRESS_LOCALITY}, ${HOTEL_ADDRESS_REGION}.`,
  },
  {
    icon: Sparkles,
    heading: 'Attentive Service',
    description: 'Responsive, personal service throughout your stay.',
  },
  {
    icon: ShieldCheck,
    heading: 'Safe & Secure',
    description: 'Secure premises for peace of mind.',
  },
]

export default function FeatureStrip() {
  return (
    <section className="section-py mx-auto max-w-6xl px-6 md:px-12">
      <div className="grid grid-cols-2 gap-10 md:grid-cols-4 md:gap-8">
        {FEATURES.map(({ icon: Icon, heading, description }) => (
          <div key={heading} className="text-center">
            <Icon className="mx-auto text-verdant" size={26} strokeWidth={1.5} />
            <p className="mt-4 font-medium text-charcoal">{heading}</p>
            <p className="mt-1 text-sm text-stone">{description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
