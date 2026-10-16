-- Adds: (1) a shared audit log for staff-initiated room changes, early
-- checkouts, and cancellation money-disposition decisions, and (2) a
-- guest credit ledger for "hold as credit" outcomes from either of those
-- flows, applied later as a payment on a future booking.
--
-- NOT applied automatically — run this against Supabase yourself.
--
-- See:
--   src/app/admin/bookings/actions.ts   (changeBookingRoom, earlyCheckout,
--                                         applyMoneyDisposition, cancelBookingByStaff)
--   src/lib/guestCredits.ts             (balance computation, shared by
--                                         both admin UI and server actions)

-- One generic table rather than three narrow ones — a room change, an
-- early checkout, and a cancellation money decision are all "staff did X
-- to a booking, here's why and what changed", read back the same way
-- (BookingDetailModal's own "Change history" section, filtered by
-- booking_id). `details` carries whatever is specific to that event_type
-- (old/new room + total for room_change; nights stayed/unused + new
-- total for early_checkout; amount + chosen disposition for
-- cancellation_money) rather than a wide table of mostly-null columns.
create table if not exists booking_audit_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references "Bookings"(id) on delete cascade,
  event_type text not null check (event_type in ('room_change', 'early_checkout', 'cancellation_money')),
  reason text,
  details jsonb not null default '{}'::jsonb,
  performed_by text,
  created_at timestamptz not null default now()
);

create index if not exists booking_audit_log_booking_id_idx on booking_audit_log (booking_id);

alter table booking_audit_log enable row level security;

create policy "staff can read booking_audit_log"
  on booking_audit_log for select
  to authenticated
  using (true);

create policy "staff can insert booking_audit_log"
  on booking_audit_log for insert
  to authenticated
  with check (true);

-- No update/delete policy — append-only audit trail, same posture as
-- booking_payments.

-- Append-only ledger (same pattern as booking_payments): a positive row
-- grants credit (from an early-checkout or paid-cancellation
-- overpayment put on hold), a negative row spends it (applied as a
-- payment on a later booking — see booking_payments.method = 'credit'
-- below). A guest's current balance is the sum of their rows, excluding
-- any expired grant — computed in application code (src/lib/
-- guestCredits.ts), not stored as a column, so it's never out of sync
-- with the ledger itself.
create table if not exists guest_credits (
  id uuid primary key default gen_random_uuid(),
  guest_email text,
  guest_phone text,
  amount numeric not null,
  -- The booking that generated a grant row (null for a spend row).
  source_booking_id uuid references "Bookings"(id) on delete set null,
  -- The booking a spend row was applied to (null for a grant row).
  applied_booking_id uuid references "Bookings"(id) on delete set null,
  -- Only meaningful on a grant row — defaults to 6 months out in
  -- application code (see CREDIT_EXPIRY_MONTHS in src/lib/guestCredits.ts),
  -- not hardcoded here so that constant stays the one place to change it.
  expires_at date,
  note text,
  performed_by text,
  created_at timestamptz not null default now()
);

create index if not exists guest_credits_guest_idx on guest_credits (guest_email, guest_phone);

alter table guest_credits enable row level security;

create policy "staff can read guest_credits"
  on guest_credits for select
  to authenticated
  using (true);

create policy "staff can insert guest_credits"
  on guest_credits for insert
  to authenticated
  with check (true);

-- Lets a held credit be applied as a payment without inventing a second
-- ledger shape — booking_payments already is "a payment event against a
-- booking", 'credit' is just one more method alongside transfer/pos.
-- Never offered in the normal Record Payment dropdown (still Transfer/
-- POS only, admin-facing UI choice, not a DB constraint) — only the
-- dedicated "Apply credit" action on a booking with an available balance
-- ever inserts this method.
alter table booking_payments drop constraint if exists booking_payments_method_check;
alter table booking_payments add constraint booking_payments_method_check
  check (method in ('transfer', 'cash', 'pos', 'card', 'other', 'credit'));
