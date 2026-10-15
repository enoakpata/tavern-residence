-- Two independent fixes for the admin Payments section:
--  1. Adds cancelled_at, set by the admin cancellation action
--     (cancelBookingByStaff in src/app/admin/bookings/actions.ts) so the
--     "Cancelled" read-only banner can show when a booking was cancelled.
--     Left null for a booking cancelled by the guest themselves (that
--     flow, src/app/(site)/booking/[id]/actions.ts, is intentionally
--     untouched) or one cancelled before this column existed.
--  2. Re-syncs amount_paid/payment_status for every EXISTING booking from
--     the actual booking_payments ledger, fixing rows left stale by the
--     bug where payment_status was computed from the raw (sometimes null)
--     total_amount column instead of the same resolved total the
--     Payments section displays (total_amount, falling back to
--     nights × price_per_night) — see resolveTotalAmount in
--     src/lib/bookingStatus.ts. That fallback mismatch is why a booking
--     could show "Total ₦180,000, Paid ₦180,000, Balance ₦0" while still
--     badged "Partial": total_amount was null, so the status computation
--     had no ceiling to compare against and could never reach "paid".
--
-- NOT applied automatically — run this against Supabase yourself.

alter table "Bookings"
  add column if not exists cancelled_at timestamptz;

with ledger_totals as (
  select booking_id, coalesce(sum(amount), 0) as paid
  from booking_payments
  where status = 'success'
  group by booking_id
),
resolved as (
  select
    b.id,
    coalesce(lt.paid, 0) as paid,
    coalesce(b.total_amount, greatest(1, (b.check_out - b.check_in)) * r.price_per_night) as total
  from "Bookings" b
  left join ledger_totals lt on lt.booking_id = b.id
  left join "Rooms" r on r.id = b.room_id
)
update "Bookings" b
set
  amount_paid = resolved.paid,
  payment_status = case
    when resolved.paid <= 0 then 'unpaid'
    when resolved.paid >= resolved.total then 'paid'
    else 'partial'
  end
from resolved
where resolved.id = b.id
  -- Never overwrites a booking already marked 'refunded' — that's a
  -- distinct, deliberately-set state this ledger-based formula doesn't
  -- understand (it only knows unpaid/partial/paid).
  and b.payment_status is distinct from 'refunded';
