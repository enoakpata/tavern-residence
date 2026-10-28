-- One-off: reprices bookings that were saved at the normal rate before
-- the October 2026 promo was added to the code (src/lib/pricing.ts).
--
-- Same rule as the app: night by night, each night from 1 to 31 October
-- 2026 at the promo rate, every other night at the room's normal
-- price_per_night. Then re-derives amount_paid/payment_status from the
-- payment ledger, the same way 20261015_add_cancelled_at_and_resync_payments.sql
-- does, since a lower total can turn a "partial" booking into "paid".
--
-- Only touches bookings that are still active (pending, confirmed,
-- checked_in) and have at least one October night. Checked-out,
-- no-show and cancelled bookings are left exactly as they are — those
-- guests have already settled (or forfeited) at the price they were
-- quoted, so repricing them would only invent an overpayment.
--
-- Safe to run more than once (it recomputes from scratch each time), so
-- running it again after the code deploy also catches any booking made
-- in between at the old price.
--
-- Run 20261028_promo_pricing_and_early_late_fees.sql FIRST (this reads
-- the fee columns it adds).
--
-- NOT applied automatically — run this against Supabase yourself.
--
-- To preview before running, execute just the SELECT below on its own:
--
--   with promo(room_name, rate) as (values
--     ('Single Room', 90000), ('Studio Room', 100000),
--     ('1-Bedroom Deluxe', 150000), ('1-Bedroom Suite', 180000)
--   )
--   select b.id, b.guest_name, r.name, b.check_in, b.check_out,
--          b.total_amount as old_total,
--          (select sum(case when n::date between date '2026-10-01' and date '2026-10-31'
--                            and p.rate is not null then p.rate else r.price_per_night end)
--             from generate_series(b.check_in, b.check_out - 1, interval '1 day') n)
--            + coalesce(b.early_checkin_fee, 0) + coalesce(b.late_checkout_fee, 0) as new_total
--   from "Bookings" b
--   join "Rooms" r on r.id = b.room_id
--   left join promo p on p.room_name = r.name
--   where b.status in ('pending', 'confirmed', 'checked_in')
--     and b.check_in <= date '2026-10-31' and b.check_out > date '2026-10-01'
--   order by b.check_in;

with promo(room_name, rate) as (
  values
    ('Single Room', 90000),
    ('Studio Room', 100000),
    ('1-Bedroom Deluxe', 150000),
    ('1-Bedroom Suite', 180000)
),
targets as (
  select
    b.id,
    (
      select sum(
        case
          when n::date between date '2026-10-01' and date '2026-10-31' and p.rate is not null
            then p.rate
          else r.price_per_night
        end
      )
      from generate_series(b.check_in, b.check_out - 1, interval '1 day') n
    ) + coalesce(b.early_checkin_fee, 0) + coalesce(b.late_checkout_fee, 0) as new_total
  from "Bookings" b
  join "Rooms" r on r.id = b.room_id
  left join promo p on p.room_name = r.name
  where b.status in ('pending', 'confirmed', 'checked_in')
    and b.check_out > b.check_in
    -- At least one night (check_in .. check_out - 1) falls in October.
    and b.check_in <= date '2026-10-31'
    and b.check_out > date '2026-10-01'
)
update "Bookings" b
set total_amount = targets.new_total
from targets
where targets.id = b.id
  and targets.new_total is not null;

-- Re-derive payment status for the same bookings from the ledger (never
-- touching a deliberately 'refunded' one).
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
from "Bookings" b2
left join ledger_totals lt on lt.booking_id = b2.id
where b2.id = b.id
  and b.status in ('pending', 'confirmed', 'checked_in')
  and b.check_out > b.check_in
  and b.check_in <= date '2026-10-31'
  and b.check_out > date '2026-10-01'
  and b.total_amount is not null
  and b.payment_status is distinct from 'refunded';
