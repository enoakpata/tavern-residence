// Server-only. What happens once a guest's online booking is actually in:
// the guest confirmation email, the hotel's notification email, the
// in-app admin notification, and refreshing the admin pages. Shared by
// the Pay in person flow (createBooking in src/app/(site)/rooms/[id]/actions.ts)
// and the Pay online flow (finalizeOnlinePayment in src/lib/onlinePayments.ts,
// reached from the guest's browser or the Paystack webhook) so both send
// exactly the same thing. Not a 'use server' file on purpose — nothing
// here should be callable from the browser.

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from './supabaseAdmin'
import { sendEmail, buildGuestConfirmationEmail, buildHotelNotificationEmail } from './email'
import { HOTEL_EMAIL } from './siteConfig'
import { displayRoomName } from './roomTypeContent'

export type PaymentOption = 'pay_online' | 'pay_in_person'

export async function sendNewBookingNotifications(args: {
  bookingId: string
  roomId: string
  guestName: string
  guestPhone: string
  guestEmail: string
  checkIn: string
  checkOut: string
  createdAt: string
  isSameDayBooking: boolean
  totalAmount: number
  cardLast4: string | null
  paymentOption: PaymentOption
}) {
  // The booking is already recorded at this point — email is a
  // nice-to-have on top, so a failure here must never turn a successful
  // booking into an error. Sent concurrently and independently so one
  // failing doesn't stop the others.
  const { data: roomData } = await supabaseAdmin
    .from('Rooms')
    .select('name, room_number')
    .eq('id', args.roomId)
    .single()
  const roomName = displayRoomName(roomData?.name, 'your room')
  const roomNumber = roomData?.room_number ?? ''

  const guestEmailContent = buildGuestConfirmationEmail({
    guestName: args.guestName,
    roomName,
    checkIn: args.checkIn,
    checkOut: args.checkOut,
    bookingId: args.bookingId,
    createdAt: args.createdAt,
    isSameDayBooking: args.isSameDayBooking,
    totalAmount: args.totalAmount,
    cardLast4: args.cardLast4 ?? undefined,
    paymentOption: args.paymentOption,
  })
  const hotelEmailContent = buildHotelNotificationEmail({
    guestName: args.guestName,
    guestPhone: args.guestPhone,
    roomNumber,
    roomName,
    checkIn: args.checkIn,
    checkOut: args.checkOut,
    paidOnlineAmount: args.paymentOption === 'pay_online' ? args.totalAmount : undefined,
  })

  const results = await Promise.allSettled([
    sendEmail({ to: args.guestEmail, ...guestEmailContent }),
    sendEmail({ to: HOTEL_EMAIL, ...hotelEmailContent }),
    supabaseAdmin.from('Notifications').insert({
      type: 'new_booking',
      message: `New booking${args.paymentOption === 'pay_online' ? ' (paid online)' : ''}: ${args.guestName} — Room ${roomNumber}`,
      booking_id: args.bookingId,
    }),
  ])
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Booking confirmation email/notification failed:', result.reason)
    }
  }

  // Keeps the admin dashboard's cached pages from showing stale data —
  // without this, a room a guest just booked online would still look
  // available to staff until they hard-reload.
  revalidatePath('/admin/bookings')
  revalidatePath('/admin/check-in/check-out')
  revalidatePath('/admin/calendar')
}
