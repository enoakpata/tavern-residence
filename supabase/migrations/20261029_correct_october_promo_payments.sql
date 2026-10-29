-- Corrects October 2026 bookings where the guest PAID the promo price but
-- staff RECORDED the payment at the normal price (before the promo
-- existed in the app). Two things were wrong on those bookings:
--   1. total_amount was the normal-price total — already fixed for active
--      bookings by 20261028b, but not for checked-out ones;
--   2. booking_payments holds the normal-price amount, not what the guest
--      actually paid.
--
-- What this does, for every October booking that is pending, confirmed,
-- checked_in or checked_out (never cancelled, no_show, or 'refunded'):
--   - sets total_amount to the promo total (night by night: 1–31 October
--     at the promo rate, other nights at the normal rate, plus any early
--     check-in / late check-out fees) — same rule as src/lib/pricing.ts;
--   - IF the payments recorded add up to exactly the normal-price total
--     (i.e. a full payment recorded at the normal price), adds ONE
--     correction row to booking_payments bringing the recorded amount
--     down to the promo total. Nothing is edited or deleted — the ledger
--     is append-only — the correction is a negative row, the same shape
--     the app's own "Void" button writes (type 'refund', with a note
--     saying exactly what it corrects; method 'other', since no money
--     actually moved);
--   - re-derives amount_paid / payment_status from the ledger.
--
-- Anything that doesn't match that exact pattern (part-payments,
-- installments, early checkouts, amounts that match neither price) is
-- NOT corrected automatically — there's no way to tell from the data
-- what that guest really paid. Those are listed at the end as
-- 'check_by_hand': fix each one in the admin dashboard with Void + Record
-- payment.
--
-- Safe to run more than once: a corrected booking's payments then equal
-- the promo total, so it's classed 'already_correct' and skipped.
--
-- Run AFTER 20261028_promo_pricing_and_early_late_fees.sql.
-- NOT applied automatically — run this against Supabase yourself.
--
-- PREVIEW FIRST: run only the "create temp table" statement below plus
--   select * from october_promo_fix order by action, check_in;
-- That changes nothing — it just shows what each booking will get.

drop table if exists october_promo_fix;

create temp table october_promo_fix as
with promo(room_name, rate) as (
  values
    ('Single Room', 90000),
    ('Studio Room', 100000),
    ('1-Bedroom Deluxe', 150000),
    ('1-Bedroom Suite', 180000)
),
base as (
  select
    b.id,
    b.guest_name,
    b.status,
    r.room_number,
    b.check_in,
    b.check_out,
    coalesce(b.early_checkin_fee, 0) + coalesce(b.late_checkout_fee, 0) as fees,
    (
      select count(*)
      from generate_series(b.check_in, b.check_out - 1, interval '1 day') n
    ) * r.price_per_night as normal_room,
    (
      select sum(
        case
          when n::date between date '2026-10-01' and date '2026-10-31' and p.rate is not null
            then p.rate
          else r.price_per_night
        end
      )
      from generate_series(b.check_in, b.check_out - 1, interval '1 day') n
    ) as promo_room,
    coalesce(
      (select sum(bp.amount) from booking_payments bp
       where bp.booking_id = b.id and bp.status = 'success'),
      0
    ) as paid_before
  from "Bookings" b
  join "Rooms" r on r.id = b.room_id
  left join promo p on p.room_name = r.name
  where b.status in ('pending', 'confirmed', 'checked_in', 'checked_out')
    and b.check_out > b.check_in
    and b.check_in <= date '2026-10-31'
    and b.check_out > date '2026-10-01'
    and b.payment_status is distinct from 'refunded'
)
select
  id,
  guest_name,
  status,
  room_number,
  check_in,
  check_out,
  normal_room + fees as normal_total,
  promo_room + fees as promo_total,
  paid_before,
  case
    when paid_before = 0 then 'unpaid'
    when paid_before = promo_room + fees then 'already_correct'
    when paid_before = normal_room + fees and promo_room < normal_room then 'auto_correct'
    else 'check_by_hand'
  end as action,
  case
    when paid_before <> promo_room + fees
     and paid_before = normal_room + fees
     and promo_room < normal_room
      then normal_room - promo_room
    else 0
  end as correction
from base;

-- 1. Totals → promo total (all listed bookings).
update "Bookings" b
set total_amount = f.promo_total
from october_promo_fix f
where f.id = b.id
  and f.promo_total is not null;

-- 2. One correction row per booking whose payment was recorded at the
--    normal price.
insert into booking_payments (booking_id, amount, method, type, note, recorded_by, status)
select
  f.id,
  -f.correction,
  'other',
  'refund',
  'Correction, not a refund: payment was recorded at the normal rate (₦'
    || to_char(f.normal_total, 'FM999,999,999') || ') but the guest paid the October promo rate (₦'
    || to_char(f.promo_total, 'FM999,999,999') || '). No money moved.',
  'October promo correction',
  'success'
from october_promo_fix f
where f.action = 'auto_correct'
  and f.correction > 0;

-- 3. Re-derive amount_paid / payment_status from the ledger.
with ledger_totals as (
  select booking_id, coalesce(sum(amount), 0) as paid
  from booking_payments
  where status = 'success'
  group by booking_id
)
update "Bookings" b
set
  amount_paid = coalesce(lt.paid, 0),
  payment_status = case
    when coalesce(lt.paid, 0) <= 0 then 'unpaid'
    when coalesce(lt.paid, 0) >= b.total_amount then 'paid'
    else 'partial'
  end
from october_promo_fix f
left join ledger_totals lt on lt.booking_id = f.id
where f.id = b.id;

-- 4. Result: one row per October booking. Check the 'check_by_hand' rows
--    (listed first) in the admin dashboard.
select
  f.action,
  f.guest_name,
  f.room_number,
  f.status,
  f.check_in,
  f.check_out,
  f.normal_total,
  f.promo_total,
  f.paid_before,
  b.amount_paid as paid_now,
  b.total_amount - b.amount_paid as balance_now,
  b.payment_status
from october_promo_fix f
join "Bookings" b on b.id = f.id
order by
  case f.action when 'check_by_hand' then 0 when 'auto_correct' then 1 else 2 end,
  f.check_in;
