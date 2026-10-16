import { Resend } from 'resend'
import { SITE_URL, HOTEL_ADDRESS, HOTEL_NAME, HOTEL_PHONE_DISPLAY, HOTEL_EMAIL } from './siteConfig'
import { formatLagosTime } from './dateUtils'
import { CANCELLATION_POLICY_BULLETS } from './cancellationPolicy'

// Exact policy wording (see cancellationPolicy.ts) as an HTML list —
// shared by the guest confirmation email below and anywhere else an
// email needs to state the policy.
const CANCELLATION_POLICY_HTML = `
  <p><strong>Cancellation Policy</strong></p>
  <ul>
    ${CANCELLATION_POLICY_BULLETS.map((bullet) => `<li>${bullet}</li>`).join('\n    ')}
  </ul>
`

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
  roomName,
  checkIn,
  checkOut,
  bookingId,
  createdAt,
  isSameDayBooking = false,
  totalAmount,
  cardLast4,
}: {
  guestName: string
  roomName: string
  checkIn: string
  checkOut: string
  bookingId: string
  createdAt?: string
  isSameDayBooking?: boolean
  // Only present for the online booking flow (BookingForm.tsx), which is
  // the only caller that captures a card — manual (walk-in/phone)
  // bookings created from the admin dashboard have neither.
  totalAmount?: number
  cardLast4?: string
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

  // Never claims payment was received — it wasn't; the stay is paid
  // directly to the hotel (transfer or card on arrival). The
  // ₦100 Paystack charge mentioned here is a verification charge only,
  // already refunded by the time this email sends.
  const paymentNotice = totalAmount
    ? `<p>Your total for this stay is ₦${totalAmount.toLocaleString()}, payable directly to us — by bank transfer or card on arrival. This isn't paid online.</p>`
    : ''
  // const cardHoldNotice = cardLast4
  //   ? `<p>We verified and securely hold a card ending ${cardLast4} to cover a cancellation or no-show fee only, per our cancellation policy below — it will never be charged for the stay itself.</p>`
  //   : ''

  const html = `
    <div style="font-family: sans-serif; color: #26241f; max-width: 480px; margin: 0 auto;">
      <p>Hi ${guestName},</p>

      <p>Thanks for booking with ${HOTEL_NAME}. Your request for the ${roomName} has been received.</p>

      <p>
        <strong>Check-in:</strong> ${formatDate(checkIn)}<br />
        <strong>Check-out:</strong> ${formatDate(checkOut)}
      </p>

      <p>Check-in time is 2:00 PM and check-out time is 12:00 PM. Early check-in or late check-out is available for a fee of 50% of the room's nightly rate, subject to availability.</p>

      ${paymentNotice}

      ${CANCELLATION_POLICY_HTML}
      ${sameDayGraceNotice ? `<p>${sameDayGraceNotice.trim()}</p>` : ''}

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
  roomName,
  checkIn,
  bookingId,
}: {
  guestName: string
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
        <strong>Room:</strong> ${roomName}<br />
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
    subject: `See you tomorrow — ${roomName} at ${HOTEL_NAME}`,
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

/**
 * Receipt for a saved-card charge (cancellation/no-show/other fee) run
 * from the admin dashboard — src/app/admin/bookings/actions.ts's
 * chargeSavedCard sends this best-effort after a successful charge. Never
 * includes the authorization code, only what the guest themselves already
 * knows about their own card (last 4 digits).
 */
export function buildChargeReceiptEmail({
  guestName,
  amount,
  reasonLabel,
  cardLast4,
}: {
  guestName: string
  amount: number
  reasonLabel: string
  cardLast4: string
}) {
  const html = `
    <div style="font-family: sans-serif; color: #26241f; max-width: 480px; margin: 0 auto;">
      <p>Hi ${guestName},</p>

      <p>This confirms a charge of <strong>₦${amount.toLocaleString()}</strong> (${reasonLabel.toLowerCase()}) to your card${cardLast4 ? ` ending ${cardLast4}` : ''}.</p>

      <p>If you have any questions about this charge, reach us at ${HOTEL_PHONE_DISPLAY} or ${HOTEL_EMAIL}.</p>

      <p>— ${HOTEL_NAME}</p>
    </div>
  `

  return {
    subject: `Receipt: ${reasonLabel} — ${HOTEL_NAME}`,
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
  // Set when a GUEST cancelled their own booking outside the free window —
  // the system never charges a fee automatically on that path, so this
  // flags that staff may want to use "Charge saved card" manually, rather
  // than claiming a fee was either charged or waived.
  feePending = false,
}: {
  guestName: string
  roomNumber: string
  roomName: string
  checkIn: string
  checkOut: string
  feeCharged: boolean
  feeAmount?: number
  feePending?: boolean
}) {
  const feeLine = feePending
    ? `Our policy suggests a ₦${(feeAmount ?? 0).toLocaleString()} cancellation fee for this booking, but nothing was charged automatically — use "Charge saved card" on the booking if you want to apply it.`
    : feeCharged
      ? `A cancellation fee of ₦${(feeAmount ?? 0).toLocaleString()} was charged to the guest's saved card.`
      : 'No cancellation fee was charged.'

  const html = `
    <div style="font-family: sans-serif; color: #26241f; max-width: 480px; margin: 0 auto;">
      <p>A booking has been cancelled:</p>
      <p>
        <strong>Guest:</strong> ${guestName}<br />
        <strong>Room:</strong> ${roomNumber} — ${roomName}<br />
        <strong>Original check-in:</strong> ${formatDate(checkIn)}<br />
        <strong>Original check-out:</strong> ${formatDate(checkOut)}
      </p>
      <p>${feeLine}</p>
      <p>View details in the admin dashboard.</p>
    </div>
  `

  return {
    subject: `Booking cancelled: ${guestName} — Room ${roomNumber}`,
    html,
  }
}

/**
 * Sent to the guest when admin moves their booking to a different room
 * TYPE (src/app/admin/bookings/actions.ts's changeBookingRoom, optional
 * "Notify guest" checkbox). Deliberately takes only room type names
 * (e.g. "Studio"), never a room number — guests never see a room number
 * anywhere, including here.
 */
export function buildRoomChangeNotificationEmail({
  guestName,
  checkIn,
  checkOut,
  fromRoomType,
  toRoomType,
  newTotal,
  totalChanged,
}: {
  guestName: string
  checkIn: string
  checkOut: string
  fromRoomType: string
  toRoomType: string
  newTotal: number
  totalChanged: boolean
}) {
  const totalLine = totalChanged
    ? `Your total for this stay is now ₦${newTotal.toLocaleString()}.`
    : `Your total for this stay is unchanged at ₦${newTotal.toLocaleString()}.`

  const html = `
    <div style="font-family: sans-serif; color: #26241f; max-width: 480px; margin: 0 auto;">
      <p>Hi ${guestName},</p>

      <p>We've moved your upcoming stay (${formatDate(checkIn)} – ${formatDate(checkOut)}) from a ${fromRoomType} to a ${toRoomType}.</p>

      <p>${totalLine}</p>

      <p>If you have any questions, reach us at ${HOTEL_PHONE_DISPLAY} or ${HOTEL_EMAIL}.</p>

      <p>— ${HOTEL_NAME}</p>
    </div>
  `

  return {
    subject: `Your room has changed — ${HOTEL_NAME}`,
    html,
  }
}
