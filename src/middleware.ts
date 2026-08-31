import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// If Supabase is slow or unreachable, we'd otherwise hang until Vercel's
// own platform-level middleware timeout kills the invocation — which
// shows a raw, unstyled Vercel error page we have no way to intercept or
// restyle from inside the app. Racing against a short internal timeout
// lets us fail on our own terms first, well before that platform timeout
// (which takes noticeably longer than this to trigger), converting a hard
// crash into an ordinary redirect to the login page instead.
const AUTH_CHECK_TIMEOUT_MS = 5000

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Racing the auth check against a short internal timeout so a slow or
  // unreachable Supabase call fails on our own terms — via the ordinary
  // "not logged in" redirect below — well before Vercel's own
  // platform-level middleware timeout could kill the invocation and show
  // its raw, unstyled error page instead (which happens at the
  // infrastructure level, before our code has any chance to respond).
  let timeoutId: ReturnType<typeof setTimeout>
  const timeout = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => resolve(null), AUTH_CHECK_TIMEOUT_MS)
  })
  const authCheck = supabase.auth.getUser().then((result) => result.data.user)
  const user = await Promise.race([authCheck, timeout])
  clearTimeout(timeoutId!)

  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
  const isLoginPage = request.nextUrl.pathname === '/admin/login'

  // Not logged in and trying to reach a protected admin page — send to
  // login, remembering where they were headed so a successful sign-in
  // can return them there instead of always landing on the dashboard.
  if (isAdminRoute && !isLoginPage && !user) {
    const loginUrl = new URL('/admin/login', request.url)
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  // Already logged in and sitting on the login page — send to the dashboard
  if (isLoginPage && user) {
    const dashboardUrl = new URL('/admin/bookings', request.url)
    return NextResponse.redirect(dashboardUrl)
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}