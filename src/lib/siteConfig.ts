// Shared site-wide constants used by metadata, sitemap.ts, and robots.ts.
// Set NEXT_PUBLIC_SITE_URL in .env.local once a production domain exists —
// everything here falls back to localhost until then.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

// Opens Google Maps with the hotel's address pre-filled — used wherever
// the address is shown as a clickable link (Contact page, Footer,
// homepage location section).
export const GOOGLE_MAPS_URL =
'https://maps.app.goo.gl/5yGCaPim1a9cjn2TA'

// The plain-text address, for anywhere it needs to be read rather than
// linked (e.g. inside an email body).
export const HOTEL_ADDRESS = 'No 20 Dele Adedeji, Lekki Phase 1, Lagos'

export const HOTEL_NAME = 'Tavern Residence'

export const HOTEL_TAGLINE =
  'Tavern Residence is a hotel in Lekki Phase 1, Lagos, offering well-appointed rooms, modern facilities, and a welcoming atmosphere suitable for both business and leisure travelers.'

export const HOTEL_PHONE_DISPLAY = '0701 583 2637'
export const HOTEL_PHONE_TEL = '+2347015832637' // used in tel: and wa.me links, no spaces/dashes

export const HOTEL_EMAIL = 'tavernresidence@gmail.com'

export const HOTEL_INSTAGRAM_HANDLE = 'tavernresidencelekki'
export const HOTEL_INSTAGRAM_URL = 'https://www.instagram.com/tavernresidencelekki'

export const HOTEL_ADDRESS_LOCALITY = 'Lekki Phase 1'
export const HOTEL_ADDRESS_REGION = 'Lagos'

// Cancellation fee as a fraction of one night's rate (0.5 = 50%)
export const CANCELLATION_FEE_FRACTION = 0.5