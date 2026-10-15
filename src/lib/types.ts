export type Room = {
  id: string
  room_number: string
  room_type: 'Studio' | '1-Bedroom' | 'Standard'
  name: string
  price_per_night: number
  description: string
  max_occupancy: number
  bed_type: string
  has_kitchenette: boolean
  has_living_area: boolean
  floor: string
  images: string[] | null
  room_size_sqm: number | null
}

export type Booking = {
  id: string
  room_id: string
  guest_name: string
  guest_phone: string
  guest_email: string | null
  check_in: string
  check_out: string
  status:
    | 'pending'
    | 'confirmed'
    | 'checked_in'
    | 'checked_out'
    | 'cancelled'
    | 'no_show'
  source: 'online' | 'walk_in' | 'phone'
  payment_method: 'card' | 'transfer'
  payment_status: 'unpaid' | 'partial' | 'paid' | 'refunded'
  // Legacy — the bare authorization code from before the card-hold
  // columns below existed. Still populated on new bookings for backward
  // compatibility, but card_authorization_code is the primary field now;
  // see getChargeableAuthCode in src/lib/bookings.ts.
  payment_token: string | null
  charge_type: 'full_stay' | 'no_show_fee' | 'late_cancellation_fee' | null
  amount_charged: number | null
  created_by: string | null
  created_at: string
  // Set only by the admin cancellation action (cancelBookingByStaff) —
  // null for a booking cancelled by the guest themselves, or one that
  // predates this column. See
  // supabase/migrations/20261015_add_cancelled_at_and_resync_payments.sql.
  cancelled_at: string | null
  reminder_sent: boolean
  // Optional free-text note from the guest at booking time (e.g. a room
  // preference) — never a room picker, just a note staff can try to
  // honor manually when assigning the physical room. See
  // supabase/migrations/20260923_add_special_requests_to_bookings.sql.
  special_requests: string | null
  // Payment is manual (transfer/POS) now — total_amount/amount_paid
  // drive the admin payment ledger (booking_payments) rather than a
  // single online charge. See
  // supabase/migrations/20261014_manual_payment_and_card_hold.sql.
  total_amount: number | null
  amount_paid: number
  // The card-on-file captured via the ₦100 Paystack verification charge
  // at booking time — used ONLY for a later cancellation/no-show fee, not
  // for charging the stay itself. Never sent to a client component or
  // exposed to a guest/anon request — server actions look these up by
  // booking id and call Paystack server-side only.
  card_authorization_code: string | null
  card_last4: string | null
  card_brand: string | null
  card_exp: string | null
  card_reusable: boolean | null
  card_consent_at: string | null
  card_consent_policy_version: string | null
  card_email: string | null
}

// 'credit' is admin-only — applying a guest's held credit (see
// src/lib/guestCredits.ts) as a payment. Never offered in the normal
// Record Payment dropdown (Transfer/POS only); only the dedicated
// "Apply credit" action inserts it.
export type BookingPaymentMethod = 'transfer' |'pos' | 'card' | 'other' | 'credit'
export type BookingPaymentType = 'payment' | 'cancellation_fee' | 'refund'
export type BookingPaymentRowStatus = 'success' | 'failed'

export type BookingPayment = {
  id: string
  booking_id: string
  amount: number
  method: BookingPaymentMethod
  type: BookingPaymentType
  reference: string | null
  note: string | null
  recorded_by: string | null
  status: BookingPaymentRowStatus
  created_at: string
}
