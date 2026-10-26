-- Resident guests who book online are checked at reception until the hotel system (OPERA) is connected.
ALTER TABLE "bookings" ADD COLUMN "guest_checked_at" TIMESTAMPTZ(6),
                       ADD COLUMN "guest_checked_by" UUID;

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_guest_checked_by_fkey"
  FOREIGN KEY ("guest_checked_by") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
