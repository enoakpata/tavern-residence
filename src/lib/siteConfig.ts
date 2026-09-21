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
  'Tavern Residence is an apartment hotel in Lekki Phase 1, Lagos, offering well-appointed rooms, modern facilities, and a welcoming atmosphere suitable for both business and leisure travelers.'

export const HOTEL_PHONE_DISPLAY = '0701 583 2637'
export const HOTEL_PHONE_TEL = '+2347015832637' // used in tel: and wa.me links, no spaces/dashes

export const HOTEL_EMAIL = 'tavernresidence@gmail.com'

export const HOTEL_INSTAGRAM_HANDLE = 'tavernresidencelekki'
export const HOTEL_INSTAGRAM_URL = 'https://www.instagram.com/tavernresidencelekki'

export const HOTEL_ADDRESS_LOCALITY = 'Lekki Phase 1'
export const HOTEL_ADDRESS_REGION = 'Lagos'

// Cancellation fee as a fraction of one night's rate (0.5 = 50%)
export const CANCELLATION_FEE_FRACTION = 0.5

// Which payment methods are offered at checkout. `card` runs through the
// existing Paystack inline-popup flow. `bank_transfer` is a manual
// fallback: enabling it shows a payment-method choice on the booking form,
// and picking it holds the room as 'pending_payment' (see
// PENDING_PAYMENT_HOLD_HOURS below) instead of charging a card up front —
// the guest is shown these bank details plus a reference code to use as
// their transfer narration. Fill in the placeholder bank details below
// with the hotel's real account before enabling this in production.
export const PAYMENT_METHODS = {
  card: { enabled: true },
  bank_transfer: {
    enabled: true,
    bankName: 'PLACEHOLDER BANK NAME',
    accountNumber: '0000000000',
    accountName: 'PLACEHOLDER ACCOUNT NAME',
  },
}

// How long a 'pending_payment' booking holds its room before the cron job
// (src/app/api/cron/auto-cancel-pending-payment) auto-cancels it and frees
// the dates back up. Shared by the cron and the guest-facing hold email so
// the two can never quote different windows.
export const PENDING_PAYMENT_HOLD_HOURS = 12