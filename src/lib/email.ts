// Server-only email helper. Never import this file into a client component —
// it uses the Resend secret key, which must never reach the browser.

import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY!

// Resend's shared onboarding sender — swap for a verified custom domain
// address once one is set up in the Resend dashboard.
const FROM_ADDRESS = 'Tavern Residence <onboarding@resend.dev>'

const resend = new Resend(RESEND_API_KEY)

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    html,
  })

  if (error) {
    throw new Error(error.message)
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * The guest-facing confirmation — same content whether the booking came in
 * through the guest-facing card-verification flow or was entered manually
 * by staff for a walk-in/phone booking.
 */
export function buildGuestConfirmationEmail({
  guestName,
  roomName,
  checkIn,
  checkOut,
}: {
  guestName: string
  roomName: string
  checkIn: string
  checkOut: string
}): { subject: string; html: string } {
  const subject = `Booking request received — ${roomName}`
  const html = `
    <p>Hi ${escapeHtml(guestName)},</p>
    <p>Thanks for booking with Tavern Residence. Your request for the <strong>${escapeHtml(roomName)}</strong> has been received.</p>
    <p>
      <strong>Check-in:</strong> ${formatDate(checkIn)}<br />
      <strong>Check-out:</strong> ${formatDate(checkOut)}
    </p>
    <p>We'll confirm with you shortly by phone or WhatsApp.</p>
    <p>— Tavern Residence</p>
  `
  return { subject, html }
}

/**
 * Sent to the hotel's own inbox so staff know a new booking came in without
 * having to check the admin dashboard proactively.
 */
export function buildHotelNotificationEmail({
  guestName,
  guestPhone,
  roomName,
  checkIn,
  checkOut,
}: {
  guestName: string
  guestPhone: string
  roomName: string
  checkIn: string
  checkOut: string
}): { subject: string; html: string } {
  const subject = `New booking — ${roomName}`
  const html = `
    <p>A new booking request just came in.</p>
    <p>
      <strong>Guest:</strong> ${escapeHtml(guestName)}<br />
      <strong>Phone:</strong> ${escapeHtml(guestPhone)}
    </p>
    <p>
      <strong>Room:</strong> ${escapeHtml(roomName)}<br />
      <strong>Check-in:</strong> ${formatDate(checkIn)}<br />
      <strong>Check-out:</strong> ${formatDate(checkOut)}
    </p>
  `
  return { subject, html }
}
