// Server-only Paystack helpers. Never import this file into a client component —
// it uses the secret key, which must never reach the browser.

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!
const PAYSTACK_BASE_URL = 'https://api.paystack.co'

type VerifyResult =
  | {
      success: true
      authorizationCode: string
      last4: string
      cardType: string
      amountKobo: number
      transactionId: number
    }
  | { success: false; error: string }

/**
 * Confirms a Paystack transaction actually succeeded, and pulls out the
 * reusable authorization_code (this is the "saved card" reference we store
 * on the booking so we can charge it later without the guest re-entering
 * card details).
 */
export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  const res = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    }
  )

  const json = await res.json()

  if (!res.ok || !json.status || json.data?.status !== 'success') {
    return { success: false, error: 'Card verification failed. Please try again.' }
  }

  const auth = json.data.authorization

  if (!auth?.authorization_code || !auth?.reusable) {
    return {
      success: false,
      error: 'This card cannot be saved for future charges. Please try a different card.',
    }
  }

  return {
    success: true,
    authorizationCode: auth.authorization_code,
    last4: auth.last4,
    cardType: auth.card_type,
    amountKobo: json.data.amount,
    transactionId: json.data.id,
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
    // valid and the booking should still go through.
    console.error('Refund failed for transaction', transactionId, json)
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

  if (!res.ok || !json.status || json.data?.status !== 'success') {
    return { success: false, error: json.message || 'Charge failed.' }
  }

  return { success: true, reference: json.data.reference }
}
