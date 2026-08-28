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