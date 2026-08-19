// Shared site-wide constants used by metadata, sitemap.ts, and robots.ts.
// Set NEXT_PUBLIC_SITE_URL in .env.local once a production domain exists —
// everything here falls back to localhost until then.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
