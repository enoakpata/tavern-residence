-- Switches payment from "charge the full stay online" to manual
-- (transfer/cash/POS), while keeping a card on file (via Paystack) for
-- cancellation/no-show fees, and adding a per-booking payment ledger so a
-- stay can be paid in installments. See:
--   src/app/(site)/rooms/[id]/actions.ts        (card-hold at booking time)
--   src/app/admin/bookings/actions.ts            (ledger + saved-card charges)
--   src/lib/paystack.ts                          (verifyTransaction/chargeAuthorization)
--
-- NOT applied automatically — run this against Supabase yourself.

-- payment_status is a plain text column today (no CHECK constraint,
-- confirmed by inserting a probe row), so the new 'partial' value needs no
-- schema change — only the TypeScript union in src/lib/types.ts changes.
--
-- card_authorization_code etc. are new, parallel columns — the existing
-- payment_token column (bare authorization code, no last4/brand/exp/
-- consent/reusable) is left untouched for any booking created before this
-- migration ships, so old rows keep working. New bookings populate both;
-- app code reads card_authorization_code first and falls back to
-- payment_token for pre-migration rows (see getChargeableAuthCode in
-- src/lib/bookings.ts).
alter table "Bookings"
  add column if not exists total_amount numeric,
  add column if not exists amount_paid numeric not null default 0,
  add column if not exists card_authorization_code text,
  add column if not exists card_last4 text,
  add column if not exists card_brand text,
  add column if not exists card_exp text,
  add column if not exists card_reusable boolean,
  add column if not exists card_consent_at timestamptz,
  add column if not exists card_consent_policy_version text,
  add column if not exists card_email text;

-- Per-booking payment ledger. Append-only by design: a correction is a
-- new negative-amount row (type 'refund'), never an edit or delete of an
-- existing row, so the history stays a true audit trail. See
-- recordPayment/voidPayment/chargeSavedCard in src/app/admin/bookings/actions.ts.
create table if not exists booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references "Bookings"(id) on delete cascade,
  amount numeric not null,
  method text not null check (method in ('transfer', 'cash', 'pos', 'card', 'other')),
  type text not null check (type in ('payment', 'cancellation_fee', 'refund')),
  reference text,
  note text,
  recorded_by text,
  status text not null default 'success' check (status in ('success', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists booking_payments_booking_id_idx on booking_payments (booking_id);

alter table booking_payments enable row level security;

-- Deliberately no policy at all for the anon role — same posture already
-- confirmed live on "Bookings" itself (anon reads it and gets 0 rows: no
-- SELECT policy exists for anon there, insert-only). Guests/anon must
-- never read this table or card_authorization_code; only the
-- authenticated staff role (admin server actions, via
-- src/lib/supabase/server.ts's cookie-based client) and the service-role
-- key (bypasses RLS entirely; used for server-only booking lookups) can
-- touch it.
create policy "staff can read booking_payments"
  on booking_payments for select
  to authenticated
  using (true);

create policy "staff can insert booking_payments"
  on booking_payments for insert
  to authenticated
  with check (true);

-- No update/delete policy for anyone — enforces the append-only ledger at
-- the database level, not just in application code.
