-- Optional free-text note a guest can leave at booking time (e.g. a room
-- preference like "stayed in a room with a balcony last time") for staff
-- to try to honor manually when assigning the physical room — see
-- src/app/(site)/rooms/[id]/BookingForm.tsx and createBooking() in
-- src/app/(site)/rooms/[id]/actions.ts. Never shown to guests as a room
-- picker; visible to staff in the admin booking detail view
-- (src/app/admin/BookingDetailModal.tsx).
alter table "Bookings"
  add column if not exists special_requests text;
