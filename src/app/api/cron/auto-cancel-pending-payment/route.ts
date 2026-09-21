import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { PENDING_PAYMENT_HOLD_HOURS } from '@/lib/siteConfig'

/**
 * Runs via Vercel Cron (see vercel.json). A bank-transfer booking
 * (BookingForm.tsx's bank-transfer checkout branch) holds its room as
 * 'pending_payment' until staff confirm the transfer arrived
 * (confirmBankTransferPayment in admin/bookings/actions.ts) — this frees
 * any that are still unconfirmed after PENDING_PAYMENT_HOLD_HOURS, the
 * same window quoted in the guest's hold email, so the dates don't stay
 * blocked indefinitely for a transfer that never comes.
 *
 * NOTE: unlike the once-daily auto-checkout/checkin-reminders crons, this
 * one is scheduled hourly in vercel.json since a 12-hour hold needs finer
 * granularity than once a day — on Vercel's Hobby plan, cron schedules are
 * throttled to at most once daily regardless of what's configured here, so
 * a hold may in practice run up to ~24h before being released on that
 * plan. Upgrade to Pro (or trigger this endpoint some other way on a
 * tighter interval) if that's not tight enough.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(
    Date.now() - PENDING_PAYMENT_HOLD_HOURS * 60 * 60 * 1000
  ).toISOString()

  const { data, error } = await supabaseAdmin
    .from('Bookings')
    .update({ status: 'cancelled' })
    .eq('status', 'pending_payment')
    .lt('created_at', cutoff)
    .select('id')

  if (error) {
    console.error('Auto-cancel pending-payment cron failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ updated: data?.length ?? 0 })
}
