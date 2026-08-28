-- Tracks whether the day-before-check-in reminder email has already been
-- sent for a booking, so the daily checkin-reminders cron job
-- (src/app/api/cron/checkin-reminders/route.ts) never emails the same
-- guest twice across separate runs.
alter table "Bookings"
  add column if not exists reminder_sent boolean not null default false;
