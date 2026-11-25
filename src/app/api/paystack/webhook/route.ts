import { NextResponse } from 'next/server'
import { isValidWebhookSignature } from '@/lib/paystack'
import { finalizeOnlinePayment } from '@/lib/onlinePayments'

/**
 * Paystack webhook — paste https://<your domain>/api/paystack/webhook into
 * the Paystack dashboard (Settings → API Keys & Webhooks).
 *
 * Backup path for Pay online bookings: if the guest closes the tab before
 * our own verify call (confirmOnlinePayment) returns, this still confirms
 * the booking on charge.success. It runs the exact same
 * finalizeOnlinePayment, which re-verifies the transaction with Paystack
 * itself (the webhook body is never trusted for amounts) and is
 * idempotent: a reference already recorded is a no-op.
 *
 * Only references we generated for Pay online (tavern_online_…) are
 * handled; the ₦100 Pay in person verification charges and saved-card fee
 * charges also send charge.success and are acknowledged and ignored.
 */
export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-paystack-signature')

  if (!isValidWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: { event?: string; data?: { reference?: string } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const reference = event.data?.reference
  if (event.event !== 'charge.success' || !reference || !reference.startsWith('tavern_online_')) {
    return NextResponse.json({ received: true })
  }

  const result = await finalizeOnlinePayment(reference)

  // A transient failure returns 500 so Paystack retries; every final
  // outcome (confirmed, already confirmed, refunded) returns 200.
  if (!result.ok && result.code === 'error') {
    return NextResponse.json({ error: 'Temporary failure' }, { status: 500 })
  }
  return NextResponse.json({ received: true })
}
