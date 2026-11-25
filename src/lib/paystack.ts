// Server-only Paystack helpers. Never import this file into a client component —
// it uses the secret key, which must never reach the browser.

import { createHmac, timingSafeEqual } from 'crypto'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!
const PAYSTACK_BASE_URL = 'https://api.paystack.co'

/**
 * True if a webhook body really came from Paystack: x-paystack-signature
 * is the HMAC-SHA512 of the raw request body, keyed with our secret key.
 * Must be given the body exactly as received (request.text()), not
 * re-serialized JSON.
 */
export function isValidWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !PAYSTACK_SECRET_KEY) return false
  const expected = createHmac('sha512', PAYSTACK_SECRET_KEY).update(rawBody).digest('hex')
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

type VerifyResult =
  | {
      success: true
      authorizationCode: string
      last4: string
      cardType: string
      expMonth: string
      expYear: string
      reusable: boolean
      amountKobo: number
      transactionId: number
    }
  // transactionId is still included on a "not reusable" failure (the
  // charge itself succeeded — a valid card can still be non-reusable) so
  // the caller can refund it; it's null when the transaction never
  // actually went through, since there's nothing to refund.
  | { success: false; error: string; transactionId: number | null }

export type PaystackAuthorization = {
  authorization_code?: string
  last4?: string
  card_type?: string
  exp_month?: string
  exp_year?: string
  reusable?: boolean
}

/** The fields of a Paystack transaction this app actually checks. */
export type PaystackTransaction = {
  // 'success' | 'failed' | 'abandoned' | 'ongoing' | 'pending' | 'reversed' …
  status: string
  reference: string
  amountKobo: number
  currency: string
  transactionId: number
  authorization: PaystackAuthorization | null
}

/**
 * Looks a transaction up by reference (Paystack's verify endpoint) and
 * returns its raw outcome, without deciding anything — null if Paystack
 * doesn't know the reference or the call itself failed. Used by
 * verifyTransaction below (the ₦100 card check) and by the Pay online
 * flow (src/lib/onlinePayments.ts), which checks amount/currency itself.
 */
export async function getTransaction(reference: string): Promise<PaystackTransaction | null> {
  try {
    const res = await fetch(
      `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
        cache: 'no-store',
      }
    )
    const json = await res.json()
    if (!res.ok || !json.status || !json.data) return null
    return {
      status: String(json.data.status),
      reference: String(json.data.reference),
      amountKobo: Number(json.data.amount),
      currency: String(json.data.currency),
      transactionId: Number(json.data.id),
      authorization: json.data.authorization ?? null,
    }
  } catch (error) {
    console.error('Paystack transaction lookup failed for', reference, error)
    return null
  }
}

/**
 * Confirms a Paystack transaction actually succeeded, and pulls out the
 * reusable authorization_code (this is the "saved card" reference we store
 * on the booking so we can charge it later without the guest re-entering
 * card details).
 */
export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  const tx = await getTransaction(reference)

  if (!tx || tx.status !== 'success') {
    return { success: false, error: 'Card verification failed. Please try again.', transactionId: null }
  }

  const auth = tx.authorization
  const transactionId = tx.transactionId

  if (!auth?.authorization_code || !auth?.reusable) {
    // The transaction itself succeeded (checked above) — a valid card can
    // still come back non-reusable, so the ₦100 was genuinely charged and
    // must be refunded even though we can't save this card. transactionId
    // is passed back specifically so the caller can do that.
    return {
      success: false,
      error: "This card can't be saved. Please use a different card.",
      transactionId,
    }
  }

  return {
    success: true,
    authorizationCode: auth.authorization_code,
    last4: auth.last4 ?? '',
    cardType: auth.card_type ?? '',
    expMonth: auth.exp_month ?? '',
    expYear: auth.exp_year ?? '',
    reusable: auth.reusable,
    amountKobo: tx.amountKobo,
    transactionId,
  }
}

/**
 * Refunds the small verification charge immediately after we've captured
 * the authorization_code. The guest should never actually be out ₦100 —
 * it's charged and refunded in the same flow.
 */
export async function refundTransaction(transactionId: number) {
  const res = await fetch(`${PAYSTACK_BASE_URL}/refund`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ transaction: transactionId }),
  })

  const json = await res.json()

  if (!res.ok || !json.status) {
    // Don't block the booking on this — log it so you can manually refund
    // if Paystack's refund call itself fails, but the card token is still
    // valid and the booking should still go through. Only the message is
    // logged, not the full response body, which can echo back
    // card/authorization details.
    console.error('Refund failed for transaction', transactionId, json.message)
    return { success: false }
  }

  return { success: true }
}

/**
 * Charges a previously-saved card using its authorization_code — this is
 * what the receptionist dashboard will call later for full-stay charges
 * or no-show/late-cancellation fees. Not used at booking time, but lives
 * here since it's the same API surface.
 */
export async function chargeAuthorization(
  authorizationCode: string,
  amountNaira: number,
  email: string
) {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/charge_authorization`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      authorization_code: authorizationCode,
      email,
      amount: Math.round(amountNaira * 100), // Paystack uses kobo
    }),
  })

  const json = await res.json()

  if (!res.ok || !json.status) {
    return { success: false, error: json.data?.gateway_response || json.message || 'Charge failed.' }
  }

  // Paystack's top-level "message" is ALWAYS "Charge attempted" — the real
  // result is in data.status. If it's not immediately "success", it may
  // still be processing (common with some test/bank cards) — wait, then
  // check again with the verify endpoint before giving up.
  if (json.data?.status === 'success') {
    return { success: true, reference: json.data.reference }
  }

  if (json.data?.status === 'pending') {
    await new Promise((resolve) => setTimeout(resolve, 10000)) // wait 10s
    const verification = await verifyTransaction(json.data.reference)
    if (verification.success) {
      return { success: true, reference: json.data.reference }
    }
    return {
      success: false,
      error: json.data?.gateway_response || 'Charge is still processing. Please check again shortly.',
    }
  }

  return { success: false, error: json.data?.gateway_response || `Charge ${json.data?.status ?? 'failed'}.` }
}
