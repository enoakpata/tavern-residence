-- "Pay online" option for guest bookings, and guest credit that no longer
-- expires. See:
--   src/lib/onlinePayments.ts                    (start / confirm / expire)
--   src/app/(site)/rooms/[id]/actions.ts         (startOnlinePayment, confirmOnlinePayment)
--   src/app/api/paystack/webhook/route.ts        (charge.success backup confirmation)
--   src/lib/guestCredits.ts                      (grantGuestCredit, expiry disabled)
--
-- NOT applied automatically — run this against Supabase yourself, BEFORE
-- deploying the code that uses it (the admin bookings list and the guest
-- booking flow read payment_option).

-- =====================================================================
-- 1. Which payment option the guest chose
-- =====================================================================
alter table "Bookings"
  add column if not exists payment_option text not null default 'pay_in_person';

alter table "Bookings" drop constraint if exists bookings_payment_option_check;
alter table "Bookings" add constraint bookings_payment_option_check
  check (payment_option in ('pay_online', 'pay_in_person'));

-- The Paystack reference generated for a Pay online booking before the
-- popup opens. The popup, our verify call and the webhook all look the
-- booking up by this.
alter table "Bookings"
  add column if not exists online_payment_reference text;

create unique index if not exists bookings_online_payment_reference_key
  on "Bookings" (online_payment_reference)
  where online_payment_reference is not null;

-- Lets the abandoned-checkout cleanup (expireAbandonedOnlineBookings) find
-- old unpaid Pay online holds cheaply.
create index if not exists bookings_pending_online_idx
  on "Bookings" (created_at)
  where status = 'pending' and payment_option = 'pay_online';

-- =====================================================================
-- 2. Never record the same Paystack reference twice
-- =====================================================================
-- Our verify call and the webhook can both try to record the same online
-- payment; this makes the second insert fail instead of double-counting.
--
-- Refund rows are left out on purpose: a void (voidPayment) stores the
-- ORIGINAL payment's id as its reference, and nothing has ever stopped a
-- payment being voided twice, so existing data may already contain
-- duplicate refund references — including them would make this index
-- fail to build.
create unique index if not exists booking_payments_reference_key
  on booking_payments (reference)
  where reference is not null and type <> 'refund';

-- =====================================================================
-- 3. Guest credit no longer expires
-- =====================================================================
-- New grants are written with expires_at = null (see grantGuestCredit in
-- src/lib/guestCredits.ts). This clears the expiry on every existing
-- grant so nobody's current credit lapses. The column stays, so expiry
-- can be switched back on later.
update guest_credits
set expires_at = null
where expires_at is not null
  and amount > 0;

-- =====================================================================
-- 4. Change history: credit from a cancelled / no-show online payment
-- =====================================================================
alter table booking_audit_log drop constraint if exists booking_audit_log_event_type_check;
alter table booking_audit_log add constraint booking_audit_log_event_type_check
  check (event_type in (
    'room_change',
    'early_checkout',
    'cancellation_money',
    'early_checkin',
    'late_checkout',
    'discount',
    'promo_reprice',
    'guest_details_updated',
    'online_payment_credit'
  ));
