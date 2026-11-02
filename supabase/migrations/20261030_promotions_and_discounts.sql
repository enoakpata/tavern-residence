-- Promotions managed from the admin dashboard (instead of hard-coded in
-- src/lib/pricing.ts), plus staff-applied discounts on individual
-- bookings. See:
--   src/lib/pricing.ts                     (how promos/discounts price a stay)
--   src/lib/promotions.ts                  (loading promos)
--   src/app/admin/promotions/              (Promotions page + actions)
--   src/app/admin/bookings/actions.ts      (setBookingDiscount)
--
-- NOT applied automatically — run this against Supabase yourself, BEFORE
-- deploying the code that reads it. (Until it's run, the site simply
-- shows normal prices — it doesn't break.)

-- =====================================================================
-- 1. Promotions
-- =====================================================================
-- A promo covers NIGHTS first_night..last_night inclusive (a night is
-- identified by the date it starts on). It turns on and off by itself on
-- those dates — nothing to "trigger". `active = false` ends it early or
-- pauses it without deleting it.
--
-- kind = 'fixed':   rates is {"<Rooms.name>": nightly price, ...}; a room
--                   type missing from rates keeps its normal price.
-- kind = 'percent': percent_off applies to every room type's normal price.
--
-- If two promos cover the same night, the guest gets the lower price.
create table if not exists promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  first_night date not null,
  last_night date not null,
  kind text not null check (kind in ('fixed', 'percent')),
  rates jsonb,
  percent_off numeric,
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotions_dates_check check (last_night >= first_night),
  constraint promotions_price_check check (
    (kind = 'fixed' and rates is not null and jsonb_typeof(rates) = 'object')
    or (kind = 'percent' and percent_off is not null and percent_off > 0 and percent_off < 100)
  )
);

create index if not exists promotions_dates_idx on promotions (first_night, last_night);

alter table promotions enable row level security;

-- Guests' pages (anon) need to READ promos to show prices; there's
-- nothing private in them. Only signed-in staff can change them.
drop policy if exists "anyone can read promotions" on promotions;
create policy "anyone can read promotions"
  on promotions for select
  to anon, authenticated
  using (true);

drop policy if exists "staff can insert promotions" on promotions;
create policy "staff can insert promotions"
  on promotions for insert
  to authenticated
  with check (true);

drop policy if exists "staff can update promotions" on promotions;
create policy "staff can update promotions"
  on promotions for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "staff can delete promotions" on promotions;
create policy "staff can delete promotions"
  on promotions for delete
  to authenticated
  using (true);

-- The October 2026 promo that was previously hard-coded — moved here so
-- prices don't change when this code deploys. Only inserted once.
insert into promotions (name, first_night, last_night, kind, rates, created_by)
select
  'October promo',
  date '2026-10-01',
  date '2026-10-31',
  'fixed',
  '{"Single Room": 90000, "Studio Room": 100000, "1-Bedroom Deluxe": 150000, "1-Bedroom Suite": 180000}'::jsonb,
  'migration'
where not exists (
  select 1 from promotions where name = 'October promo' and first_night = date '2026-10-01'
);

-- =====================================================================
-- 2. Staff discounts on a booking
-- =====================================================================
-- discount_amount: the naira amount currently taken off the total.
-- discount_percent: set only for a percentage discount — the amount is
--   then recalculated from the room total whenever the stay is repriced
--   (dates edited, room changed, early checkout), so 10% stays 10%.
-- discount_reason: required by the app whenever a discount is set.
-- total_amount always already has the discount taken off.
alter table "Bookings"
  add column if not exists discount_amount numeric,
  add column if not exists discount_percent numeric,
  add column if not exists discount_reason text;

-- =====================================================================
-- 3. Change history: discounts, and repricing from a promo
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
    'promo_reprice'
  ));
