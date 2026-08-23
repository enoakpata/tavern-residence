'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function endSession() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}

export async function signOut() {
  await endSession()
  redirect('/admin/login')
}

/**
 * Same as signOut, but preserves the page the staff member was on so
 * signing back in returns them there — used by the inactivity
 * auto-logout, where losing your place is more disruptive than after a
 * deliberate manual sign-out. Kept as a separate function (rather than an
 * optional parameter on signOut) since signOut is also used directly as
 * a <form action>, which would otherwise pass it a FormData object.
 */
export async function signOutFrom(redirectTo: string) {
  await endSession()
  redirect(`/admin/login?redirect=${encodeURIComponent(redirectTo)}`)
}
