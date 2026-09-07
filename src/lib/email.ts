import { Resend } from 'resend'
import {
  SITE_URL,
  HOTEL_ADDRESS,
  HOTEL_NAME,
  HOTEL_PHONE_DISPLAY,
  HOTEL_EMAIL,
  CANCELLATION_FEE_FRACTION,
} from './siteConfig'
import { formatLagosTime } from './dateUtils'

const RESEND_API_KEY = process.env.RESEND_API_KEY!
// TODO: replace with buyer's verified sending domain
const FROM_ADDRESS = `${HOTEL_NAME} Booking <bookings@tavernresidence.com.ng>`

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
    replyTo: HOTEL_EMAIL,
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

      <p>Thanks for booking with ${HOTEL_NAME}. Your request for Room ${roomNumber} — ${roomName} — has been received.</p>

      <p>
        <strong>Check-in:</strong> ${formatDate(checkIn)}<br />
        <strong>Check-out:</strong> ${formatDate(checkOut)}
      </p>

      <p>Check-in time is 2:00 PM and check-out time is 12:00 PM. Early check-in or late check-out is available for a fee of 50% of the room's nightly rate, subject to availability.</p>

      <p>Please note our cancellation policy: free cancellation up to 24 hours before check-in. Cancellations within 24 hours of check-in, or no-shows, are charged ${CANCELLATION_FEE_FRACTION * 100}% of the total booking value.${sameDayGraceNotice}</p>

      <p>If you have any questions, reach us at ${HOTEL_PHONE_DISPLAY} or ${HOTEL_EMAIL}.</p>

      <p>Need to make changes? Manage your booking here: <a href="${manageUrl}">${manageUrl}</a></p>

      <p>Thank you again — we look forward to having you and hope you have a wonderful stay!</p>

      <p>— ${HOTEL_NAME}</p>
    </div>
  `

  return {
    subject: `Booking Request Received — ${HOTEL_NAME}`,
    html,
  }
}

export function buildCheckinReminderEmail({
  guestName,
  roomNumber,
  roomName,
  checkIn,
  bookingId,
}: {
  guestName: string
  roomNumber: string
  roomName: string
  checkIn: string
  bookingId: string
}) {
  const manageUrl = `${SITE_URL}/booking/${bookingId}`

  const html = `
    <div style="font-family: sans-serif; color: #26241f; max-width: 480px; margin: 0 auto;">
      <p>Hi ${guestName},</p>

      <p>Just a reminder that your stay at ${HOTEL_NAME} begins tomorrow, ${formatDate(checkIn)}.</p>

      <p>
        <strong>Room:</strong> ${roomNumber} — ${roomName}<br />
        <strong>Check-in from:</strong> 2:00 PM<br />
        <strong>Address:</strong> ${HOTEL_ADDRESS}
      </p>

      <p>If anything about your booking has changed, you can manage it here: <a href="${manageUrl}">${manageUrl}</a></p>

      <p>If you have any questions, reach us at ${HOTEL_PHONE_DISPLAY} or ${HOTEL_EMAIL}.</p>

      <p>We look forward to having you!</p>

      <p>— ${HOTEL_NAME}</p>
    </div>
  `

  return {
    subject: `See you tomorrow — Room ${roomNumber} at ${HOTEL_NAME}`,
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
