-- Guest-detail editing and permanent booking deletion from the admin
-- "Edit booking" panel. See:
--   src/app/admin/bookings/actions.ts   (updateGuestDetails, deleteBooking)
--   src/app/admin/bookings/BookingActions.tsx
--
-- NOT applied automatically — run this against Supabase yourself, BEFORE
-- (or together with) deploying the code that uses it. Until it's run,
-- guest-detail edits still save but their change-history entry is
-- rejected by the CHECK constraint below, and Delete shows a "run the
-- migration" message instead of deleting anything.

-- =====================================================================
-- 1. Change history: guest details edited
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
    'guest_details_updated'
  ));

-- =====================================================================
-- 2. Permanently delete a booking
-- =====================================================================
-- booking_payments and booking_audit_log are deliberately append-only (no
-- DELETE policy for anyone), so the delete runs here as SECURITY DEFINER
-- instead of opening up a general DELETE policy on those tables. One
-- function = one transaction: either everything goes or nothing does.
--
-- Refuses (returns ok=false, deletes nothing) if the booking still has any
-- successful positive payment that hasn't been voided — a void is a
-- 'refund' row whose `reference` is the original payment's id (see
-- voidPayment in actions.ts). Failed charge attempts don't count.
--
-- guest_credits rows are NOT deleted: their FKs are ON DELETE SET NULL, so
-- a credit the guest holds survives with its source/applied booking
-- cleared. That credit is the guest's money, not the booking's history.
create or replace function delete_booking(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_unvoided_count integer;
  v_unvoided_total numeric;
begin
  -- Same "staff" definition every RLS policy in this project uses.
  if (select auth.role()) is distinct from 'authenticated' then
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;

  -- Lock the row so a payment can't be recorded mid-delete.
  select status into v_status from "Bookings" where id = p_booking_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select count(*), coalesce(sum(p.amount), 0)
    into v_unvoided_count, v_unvoided_total
  from booking_payments p
  where p.booking_id = p_booking_id
    and p.status = 'success'
    and p.amount > 0
    and not exists (
      select 1
      from booking_payments v
      where v.booking_id = p_booking_id
        and v.type = 'refund'
        and v.status = 'success'
        and v.reference = p.id::text
    );

  if v_unvoided_count > 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'has_payments',
      'count', v_unvoided_count,
      'total', v_unvoided_total,
      'status', v_status
    );
  end if;

  delete from booking_payments where booking_id = p_booking_id;
  delete from booking_audit_log where booking_id = p_booking_id;

  -- "Notifications" was created outside these migrations, so don't assume
  -- it exists (or the type of its booking_id column).
  if to_regclass('public."Notifications"') is not null then
    execute 'delete from "Notifications" where booking_id::text = $1' using p_booking_id::text;
  end if;

  delete from "Bookings" where id = p_booking_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function delete_booking(uuid) from public;
revoke all on function delete_booking(uuid) from anon;
grant execute on function delete_booking(uuid) to authenticated;
