import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { todayInLagos } from '@/lib/dateUtils'

/**
 * Runs once daily via Vercel Cron (see vercel.json). Moves any booking
 * that was actually checked in and whose check-out date has passed to
 * checked_out — never touches bookings that were never checked in, so a
 * no-show is never silently marked as checked out.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = todayInLagos()

  const { data, error } = await supabaseAdmin
    .from('Bookings')
    .update({ status: 'checked_out' })
    .eq('status', 'checked_in')
    .lte('check_out', today)
    .select('id')

  if (error) {
    console.error('Auto-checkout cron failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ updated: data?.length ?? 0 })
}
