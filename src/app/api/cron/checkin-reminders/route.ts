import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { tomorrowInLagos } from '@/lib/dateUtils'
import { sendEmail, buildCheckinReminderEmail } from '@/lib/email'

/**
 * Runs once daily via Vercel Cron (see vercel.json). Emails every guest
 * whose confirmed booking checks in tomorrow — reminder_sent is flipped
 * true right after a successful send so the next day's run (or a retry of
 * today's) never emails the same booking twice. Only reminder_sent gates
 * this, not the check_in date alone, since a booking's check_in date
 * stays "tomorrow" for the guest all day but this route may run more than
 * once (manual retriggers, Vercel retries on a transient failure).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tomorrow = tomorrowInLagos()

  const { data: bookings, error } = await supabaseAdmin
    .from('Bookings')
    .select('id, guest_name, guest_email, check_in, Rooms(room_number, name)')
    .eq('check_in', tomorrow)
    .eq('status', 'confirmed')
    .eq('reminder_sent', false)

  if (error) {
    console.error('Check-in reminder cron failed to fetch bookings:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let sent = 0
  let failed = 0

  for (const booking of bookings ?? []) {
    if (!booking.guest_email) continue

    const room = Array.isArray(booking.Rooms) ? booking.Rooms[0] : booking.Rooms

    try {
      await sendEmail({
        to: booking.guest_email,
        ...buildCheckinReminderEmail({
          guestName: booking.guest_name,
          roomNumber: room?.room_number ?? '',
          roomName: room?.name ?? 'your room',
          checkIn: booking.check_in,
          bookingId: booking.id,
        }),
      })

      // Marked immediately after each successful send (not batched at the
      // end) so a failure partway through this run doesn't cause bookings
      // that already got their email to receive a second one on retry.
      await supabaseAdmin
        .from('Bookings')
        .update({ reminder_sent: true })
        .eq('id', booking.id)

      sent += 1
    } catch (sendError) {
      console.error('Check-in reminder failed to send for booking', booking.id, sendError)
      failed += 1
    }
  }

  return NextResponse.json({ sent, failed })
}
