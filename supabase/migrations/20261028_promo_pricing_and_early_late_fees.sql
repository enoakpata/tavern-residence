-- Early check-in / late check-out as optional, staff-added extras on a
-- booking. Each is a flat ₦50,000 (EARLY_LATE_FEE in src/lib/pricing.ts),
-- fixed at the moment it's added. See:
--   src/lib/pricing.ts                    (earlyLateFee, extraFeesTotal)
--   src/app/admin/bookings/actions.ts     (setEarlyLateOption, and the
--                                          total recalculations that
--                                          carry these fees over)
--
-- Promo pricing itself needs NO schema change — promo rates live in
-- src/lib/pricing.ts as a dated override on top of price_per_night. To
-- reprice bookings already made before the promo was added, run
-- 20261028b_reprice_october_promo_bookings.sql AFTER this file.
--
-- NOT applied automatically — run this against Supabase yourself.

-- Null = not added. A stored amount (rather than a boolean) so the fee a
-- guest agreed to stays fixed even if the fee is changed later.
-- total_amount always already INCLUDES these — every write path stores
-- stay total + fees.
alter table "Bookings"
  add column if not exists early_checkin_fee numeric,
  add column if not exists late_checkout_fee numeric;

-- Lets the shared audit log record adding/removing either extra, read
-- back in the booking's "Change history" (BookingAuditHistory.tsx).
alter table booking_audit_log drop constraint if exists booking_audit_log_event_type_check;
alter table booking_audit_log add constraint booking_audit_log_event_type_check
  check (event_type in (
    'room_change',
    'early_checkout',
    'cancellation_money',
    'early_checkin',
    'late_checkout'
  ));
