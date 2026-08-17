import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Used in Server Components, Server Actions, and Route Handlers under
// /admin — this one knows about the logged-in staff session, unlike the
// plain client in src/lib/supabase.ts which is used for public-facing
// reads (guests browsing rooms, submitting bookings).
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll is called from a Server Component sometimes, where
            // cookies can't be mutated — safe to ignore since middleware
            // handles refreshing the session in that case.
          }
        },
      },
    }
  )
}
