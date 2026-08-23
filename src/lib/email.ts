import { Resend } from 'resend'
import { SITE_URL } from './siteConfig'
import { formatLagosTime } from './dateUtils'

const RESEND_API_KEY = process.env.RESEND_API_KEY!
const FROM_ADDRESS = 'Tavern Residence Booking <bookings@tavernresidence.com.ng>'

const resend = new Resend(RESEND_API_KEY)

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    html,
    replyTo: 'tavernresidence@gmail.com',
  })
}

function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function buildGuestConfirmationEmail({
  guestName,
  roomNumber,
  roomName,
  checkIn,
  checkOut,
  bookingId,
  createdAt,
  isSameDayBooking = false,
}: {
  guestName: string
  roomNumber: string
  roomName: string
  checkIn: string
  checkOut: string
  bookingId: string
  createdAt?: string
  isSameDayBooking?: boolean
}) {
  const manageUrl = `${SITE_URL}/booking/${bookingId}`

  // Same-day bookings can never be 24 hours from check-in, so they get a
  // separate 1-hour grace period from booking time instead — worth
  // calling out explicitly since the general policy paragraph below
  // wouldn't otherwise make that clear. Only shown when we actually have
  // a created_at to compute the cutoff from (the online booking flow
  // passes one; other callers of this email don't need this notice).
  const sameDayGraceNotice = isSameDayBooking && createdAt
    ? ` Since your check-in is today, you can also cancel for free until ${formatLagosTime(
        new Date(new Date(createdAt).getTime() + 60 * 60 * 1000)
      )} (1 hour after booking).`
    : ''

  const html = `
    <div style="font-family: sans-serif; color: #26241f; max-width: 480px; margin: 0 auto;">
      <p>Hi ${guestName},</p>

      <p>Thanks for booking with Tavern Residence. Your request for Room ${roomNumber} — ${roomName} — has been received.</p>

      <p>
        <strong>Check-in:</strong> ${formatDate(checkIn)}<br />
        <strong>Check-out:</strong> ${formatDate(checkOut)}
      </p>

      <p>Check-in time is 2:00 PM and check-out time is 12:00 PM. Early check-in or late check-out is available for a fee of 50% of the room's nightly rate, subject to availability.</p>

      <p>Please note our cancellation policy: free cancellation up to 24 hours before check-in. Cancellations within 24 hours of check-in, or no-shows, are charged 50% of the total booking value.${sameDayGraceNotice}</p>

      <p>If you have any questions, reach us at 0701 583 2637 or tavernresidence@gmail.com.</p>

      <p>Need to make changes? Manage your booking here: <a href="${manageUrl}">${manageUrl}</a></p>

      <p>Thank you again — we look forward to having you and hope you have a wonderful stay!</p>

      <p>— Tavern Residence</p>
    </div>
  `

  return {
    subject: 'Booking Request Received — Tavern Residence',
    html,
  }
}

export function buildHotelNotificationEmail({
  guestName,
  guestPhone,
  guestEmail,
  roomNumber,
  roomName,
  checkIn,
  checkOut,
}: {
  guestName: string
  guestPhone: string
  guestEmail?: string
  roomNumber: string
  roomName: string
  checkIn: string
  checkOut: string
}) {
  const html = `
    <div style="font-family: sans-serif; color: #26241f; max-width: 480px; margin: 0 auto;">
      <p>New booking request received:</p>
      <p>
        <strong>Guest:</strong> ${guestName}<br />
        <strong>Phone:</strong> ${guestPhone}<br />
        ${guestEmail ? `<strong>Email:</strong> ${guestEmail}<br />` : ''}
        <strong>Room:</strong> ${roomNumber} — ${roomName}<br />
        <strong>Check-in:</strong> ${formatDate(checkIn)}<br />
        <strong>Check-out:</strong> ${formatDate(checkOut)}
      </p>
      <p>View and confirm this booking in the admin dashboard.</p>
    </div>
  `

  return {
    subject: `New booking: ${guestName} — Room ${roomNumber}`,
    html,
  }
}

export function buildCancellationNotificationEmail({
  guestName,
  roomNumber,
  roomName,
  checkIn,
  checkOut,
  feeCharged,
  feeAmount,
}: {
  guestName: string
  roomNumber: string
  roomName: string
  checkIn: string
  checkOut: string
  feeCharged: boolean
  feeAmount?: number
}) {
  const html = `
    <div style="font-family: sans-serif; color: #26241f; max-width: 480px; margin: 0 auto;">
      <p>A booking has been cancelled:</p>
      <p>
        <strong>Guest:</strong> ${guestName}<br />
        <strong>Room:</strong> ${roomNumber} — ${roomName}<br />
        <strong>Original check-in:</strong> ${formatDate(checkIn)}<br />
        <strong>Original check-out:</strong> ${formatDate(checkOut)}
      </p>
      <p>
        ${
          feeCharged
            ? `A cancellation fee of ₦${(feeAmount ?? 0).toLocaleString()} was charged to the guest's saved card.`
            : 'No cancellation fee was charged.'
        }
      </p>
      <p>View details in the admin dashboard.</p>
    </div>
  `

  return {
    subject: `Booking cancelled: ${guestName} — Room ${roomNumber}`,
    html,
  }
}
