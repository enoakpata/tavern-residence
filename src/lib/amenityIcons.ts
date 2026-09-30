import type { ComponentType } from 'react'
import { BedDouble, AirVent, Tv, Wifi, ShowerHead, CookingPot, Sofa, Toilet } from 'lucide-react'
import IronIcon from '@/components/icons/IronIcon'

export type AmenityIcon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>

// One icon per amenity string used across the site's 4 room types —
// shared by the homepage's Our Rooms section (OurRooms.tsx) and the
// /rooms room-type detail modal, so both ever only reference one set.
// Thin-line lucide icons (matching FeatureStrip.tsx's existing use of the
// same set) for everything lucide already covers; IronIcon is the one
// hand-drawn exception, since lucide has no clothes-iron icon.
export const AMENITY_ICONS: Record<string, AmenityIcon> = {
  'King bed': BedDouble,
  'Air conditioning': AirVent,
  'Smart TV': Tv,
  Iron: IronIcon,
  'Free Wi-Fi': Wifi,
  'Ensuite bathroom with shower': ShowerHead,
  'Dry Kitchenette': CookingPot,
  'Living area': Sofa,
  'Guest Toilet': Toilet,
  // Shorter label variants used by the /rooms row list's compact spec
  // line (roomTypeContent.ts's rowAmenities) — same icons as their
  // longer-form counterparts above, just a second key each, since the
  // row list's copy is intentionally terser than the modal's full list.
  'Ensuite bathroom': ShowerHead,
  'Dry kitchenette': CookingPot,
  'Guest toilet': Toilet,
}
