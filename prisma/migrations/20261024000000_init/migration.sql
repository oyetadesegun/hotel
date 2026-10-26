-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "membership_duration" AS ENUM ('1m', '3m', '6m', 'annual');

-- CreateEnum
CREATE TYPE "staff_role" AS ENUM ('manager', 'team', 'finance', 'it_admin');

-- CreateEnum
CREATE TYPE "customer_kind" AS ENUM ('member', 'resident_guest', 'walk_in');

-- CreateEnum
CREATE TYPE "application_status" AS ENUM ('paid_waiting_review', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('reserved', 'booked', 'used', 'cancelled', 'expired', 'no_show');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('online', 'pos', 'cash', 'transfer');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('initiated', 'succeeded', 'failed', 'needs_reconciling', 'refunded');

-- CreateEnum
CREATE TYPE "refund_status" AS ENUM ('to_approve', 'approved', 'paid_out', 'declined');

-- CreateTable
CREATE TABLE "facilities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "session_minutes" INTEGER NOT NULL DEFAULT 60,
    "opens_at" TIME(6) NOT NULL DEFAULT '07:00:00'::time without time zone,
    "closes_at" TIME(6) NOT NULL DEFAULT '24:00:00'::time without time zone,
    "max_sessions_per_day" INTEGER NOT NULL DEFAULT 2,
    "book_ahead_days" INTEGER NOT NULL DEFAULT 7,
    "walk_in_rate_kobo" BIGINT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "rate_per_hour_kobo" BIGINT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "rental_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_rates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category" TEXT NOT NULL,
    "duration" "membership_duration" NOT NULL,
    "price_kobo" BIGINT,
    "effective_from" DATE NOT NULL,

    CONSTRAINT "membership_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "terms_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version" TEXT NOT NULL,
    "body_markdown" TEXT NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terms_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_users" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "staff_role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kind" "customer_kind" NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "member_id" UUID,
    "room_number" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_ref" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "duration" "membership_duration" NOT NULL,
    "gymq_number" TEXT,
    "status" "application_status" NOT NULL DEFAULT 'paid_waiting_review',
    "photo_path" TEXT,
    "card_issued_at" TIMESTAMPTZ(6),
    "starts_on" DATE,
    "ends_on" DATE,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "facility_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "booking_status" NOT NULL,
    "priority" BOOLEAN NOT NULL DEFAULT false,
    "hold_expires_at" TIMESTAMPTZ(6),
    "terms_version" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_rentals" (
    "booking_id" UUID NOT NULL,
    "rental_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "rate_per_hour_kobo" BIGINT NOT NULL,

    CONSTRAINT "booking_rentals_pkey" PRIMARY KEY ("booking_id","rental_item_id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID,
    "membership_id" UUID,
    "method" "payment_method" NOT NULL,
    "status" "payment_status" NOT NULL,
    "amount_kobo" BIGINT NOT NULL,
    "gateway_ref" TEXT,
    "receipt_ref" TEXT,
    "recorded_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "amount_kobo" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "refund_status" NOT NULL DEFAULT 'to_approve',
    "decided_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "item" TEXT,
    "details" JSONB,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "facilities_slug_key" ON "facilities"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "rental_items_facility_id_name_key" ON "rental_items"("facility_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "membership_rates_category_duration_effective_from_key" ON "membership_rates"("category", "duration", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "terms_versions_version_key" ON "terms_versions"("version");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_email_idx" ON "customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_application_ref_key" ON "memberships"("application_ref");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_gymq_number_key" ON "memberships"("gymq_number");

-- CreateIndex
CREATE INDEX "memberships_customer_id_idx" ON "memberships"("customer_id");

-- CreateIndex
CREATE INDEX "memberships_status_idx" ON "memberships"("status");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_code_key" ON "bookings"("code");

-- CreateIndex
CREATE INDEX "bookings_facility_id_starts_at_idx" ON "bookings"("facility_id", "starts_at");

-- CreateIndex
CREATE INDEX "bookings_customer_id_starts_at_idx" ON "bookings"("customer_id", "starts_at");

-- CreateIndex
CREATE INDEX "bookings_status_hold_expires_at_idx" ON "bookings"("status", "hold_expires_at");

-- CreateIndex
CREATE INDEX "booking_rentals_rental_item_id_idx" ON "booking_rentals"("rental_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gateway_ref_key" ON "payments"("gateway_ref");

-- CreateIndex
CREATE INDEX "payments_booking_id_idx" ON "payments"("booking_id");

-- CreateIndex
CREATE INDEX "payments_membership_id_idx" ON "payments"("membership_id");

-- CreateIndex
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE INDEX "refunds_status_idx" ON "refunds"("status");

-- CreateIndex
CREATE INDEX "audit_log_at_idx" ON "audit_log"("at");

-- AddForeignKey
ALTER TABLE "rental_items" ADD CONSTRAINT "rental_items_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_terms_version_fkey" FOREIGN KEY ("terms_version") REFERENCES "terms_versions"("version") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_rentals" ADD CONSTRAINT "booking_rentals_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_rentals" ADD CONSTRAINT "booking_rentals_rental_item_id_fkey" FOREIGN KEY ("rental_item_id") REFERENCES "rental_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- =====================================================================
-- Hand-written SQL: rules Prisma cannot express in schema.prisma.
-- =====================================================================

-- btree_gist lets one exclusion constraint mix "=" on uuid with "&&" on ranges.
-- Supabase keeps extensions in the "extensions" schema.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- ---------- Check constraints ----------
ALTER TABLE "facilities"
  ADD CONSTRAINT "facilities_session_minutes_check" CHECK (session_minutes IN (30, 60, 90, 120)),
  ADD CONSTRAINT "facilities_max_sessions_check" CHECK (max_sessions_per_day > 0),
  ADD CONSTRAINT "facilities_book_ahead_check" CHECK (book_ahead_days >= 0),
  ADD CONSTRAINT "facilities_walk_in_rate_check" CHECK (walk_in_rate_kobo IS NULL OR walk_in_rate_kobo >= 0);

ALTER TABLE "rental_items"
  ADD CONSTRAINT "rental_items_rate_check" CHECK (rate_per_hour_kobo >= 0);

ALTER TABLE "membership_rates"
  ADD CONSTRAINT "membership_rates_price_check" CHECK (price_kobo IS NULL OR price_kobo >= 0);

ALTER TABLE "memberships"
  ADD CONSTRAINT "memberships_dates_check" CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on > starts_on);

ALTER TABLE "booking_rentals"
  ADD CONSTRAINT "booking_rentals_quantity_check" CHECK (quantity > 0),
  ADD CONSTRAINT "booking_rentals_rate_check" CHECK (rate_per_hour_kobo >= 0);

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_check" CHECK (amount_kobo >= 0),
  -- A payment is for exactly one booking or one membership.
  ADD CONSTRAINT "payments_one_target_check" CHECK (num_nonnulls(booking_id, membership_id) = 1);

ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_amount_check" CHECK (amount_kobo > 0);

-- ---------- No double bookings ----------
-- Two live bookings can never overlap on the same facility. The database enforces this,
-- so a race between two customers cannot create a double booking.
-- Prisma reports this as error P2039 with database code 23P01 (exclusion_violation).
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_slot_check" CHECK (ends_at > starts_at),
  ADD CONSTRAINT "no_double_booking" EXCLUDE USING gist (
    facility_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status IN ('reserved', 'booked', 'used'));

-- ---------- Staff users belong to Supabase Auth ----------
-- staff_users.id must be an existing Supabase Auth user. This is a trigger, not a
-- foreign key, because Prisma cannot introspect foreign keys into the auth schema.
-- It is skipped where auth.users does not exist (Prisma's shadow database).
CREATE FUNCTION staff_users_require_auth_user() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.id) THEN
    RAISE EXCEPTION 'staff_users.id % is not a Supabase Auth user', NEW.id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER staff_users_require_auth_user
  BEFORE INSERT OR UPDATE OF id ON "staff_users"
  FOR EACH ROW EXECUTE FUNCTION staff_users_require_auth_user();

-- ---------- Audit trail is append only ----------
CREATE FUNCTION audit_log_immutable() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append only';
END $$;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON "audit_log"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();

-- ---------- Row level security ----------
-- Every table in "public" is reachable through Supabase's Data API with the publishable key.
-- RLS is on for ALL tables with no policies, so that API sees nothing by default.
-- The app reads and writes through Prisma on the server, which connects as the table
-- owner and is not affected. Add policies per role before exposing any table to the browser.
ALTER TABLE "facilities"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rental_items"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membership_rates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settings"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "terms_versions"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_users"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bookings"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_rentals"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refunds"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log"        ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- The trigger functions are internal; keep them out of the Data API's RPC endpoint.
REVOKE EXECUTE ON FUNCTION audit_log_immutable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION staff_users_require_auth_user() FROM PUBLIC, anon, authenticated;
