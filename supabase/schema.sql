-- SUPERSEDED: the live schema is now managed by Prisma.
-- Source of truth: prisma/schema.prisma + prisma/migrations/. Kept for reference only; do not run.

-- Recreation Facilities Booking System: database schema (PostgreSQL / Supabase).
-- Everything an administrator may need to change (facilities, rental items, prices,
-- rules, terms, notification wording) is a row here, never a hard-coded value.

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ---------- Setup data (admin editable) ----------

create table facilities (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  session_minutes int  not null default 60 check (session_minutes in (30, 60, 90, 120)),
  opens_at       time not null default '07:00',
  closes_at      time not null default '24:00',
  max_sessions_per_day int not null default 2,
  book_ahead_days int not null default 7,
  walk_in_rate_kobo bigint,                       -- null until tariffs are confirmed
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table rental_items (
  id             uuid primary key default gen_random_uuid(),
  facility_id    uuid not null references facilities(id),
  name           text not null,
  rate_per_hour_kobo bigint not null check (rate_per_hour_kobo >= 0),
  active         boolean not null default true
);

create table membership_rates (
  id             uuid primary key default gen_random_uuid(),
  category       text not null,                   -- Individual, Couple, Family, Extra child, Corporate
  duration       text not null check (duration in ('1m', '3m', '6m', 'annual')),
  price_kobo     bigint,                          -- null = agreed per company
  effective_from date not null,
  unique (category, duration, effective_from)
);

create table settings (
  key            text primary key,                -- e.g. hold_unpaid_hours, application_form_fee_kobo
  value          jsonb not null,
  updated_by     uuid,
  updated_at     timestamptz not null default now()
);

create table terms_versions (
  id             uuid primary key default gen_random_uuid(),
  version        text not null unique,
  body_markdown  text not null,
  published_at   timestamptz,
  created_at     timestamptz not null default now()
);

-- ---------- People ----------

create type staff_role as enum ('manager', 'team', 'finance', 'it_admin');

create table staff_users (
  id             uuid primary key references auth.users(id),
  full_name      text not null,
  role           staff_role not null,
  active         boolean not null default true
);

create type customer_kind as enum ('member', 'resident_guest', 'walk_in');

create table customers (
  id             uuid primary key default gen_random_uuid(),
  kind           customer_kind not null,
  full_name      text not null,
  phone          text,
  email          text,
  member_id      uuid,                            -- set when kind = 'member'
  room_number    text,                            -- resident guests
  created_at     timestamptz not null default now()
);

create type application_status as enum ('profile_pending', 'paid_waiting_review', 'approved', 'rejected');

create table memberships (
  id             uuid primary key default gen_random_uuid(),
  application_ref text not null unique,           -- MA-2026-0418
  customer_id    uuid not null references customers(id),
  category       text not null,
  duration       text not null,
  gymq_number    text unique,                     -- typed in from GymQ. This system NEVER generates one.
  status         application_status not null default 'paid_waiting_review', -- online sign-ups start at 'profile_pending'
  photo_path     text,
  profile        jsonb,                           -- online application form answers; health answers are Recreation Manager only
  profile_completed_at timestamptz,
  card_issued_at timestamptz,
  starts_on      date,
  ends_on        date,
  rejection_reason text,
  created_at     timestamptz not null default now()
);

-- ---------- Bookings ----------

create type booking_status as enum (
  'reserved',   -- unpaid hold, expires
  'booked',     -- paid, or free for members and resident guests
  'used',
  'cancelled',
  'expired',
  'no_show'
);

create table bookings (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,            -- BK-7Q4M-2931
  facility_id    uuid not null references facilities(id),
  customer_id    uuid not null references customers(id),
  slot           tstzrange not null,
  status         booking_status not null,
  priority       boolean not null default false,  -- recurring booking by an authorised administrator
  hold_expires_at timestamptz,
  terms_version  text references terms_versions(version),
  created_by     uuid,                            -- staff user, null when booked online
  created_at     timestamptz not null default now(),

  -- Two live bookings can never overlap on the same facility. The database enforces this,
  -- so a race between two customers cannot create a double booking.
  constraint no_double_booking exclude using gist (
    facility_id with =,
    slot with &&
  ) where (status in ('reserved', 'booked', 'used'))
);

create table booking_rentals (
  booking_id     uuid not null references bookings(id) on delete cascade,
  rental_item_id uuid not null references rental_items(id),
  quantity       int not null default 1 check (quantity > 0),
  rate_per_hour_kobo bigint not null,             -- price at the time of booking
  primary key (booking_id, rental_item_id)
);

create type payment_method as enum ('online', 'pos', 'cash', 'transfer');
create type payment_status as enum ('initiated', 'succeeded', 'failed', 'needs_reconciling', 'refunded');

create table payments (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid references bookings(id),
  membership_id  uuid references memberships(id),
  method         payment_method not null,
  status         payment_status not null,
  amount_kobo    bigint not null,
  gateway_ref    text unique,                     -- unique, so repeated webhooks never create a second payment
  receipt_ref    text,
  recorded_by    uuid,
  created_at     timestamptz not null default now()
);

create table refunds (
  id             uuid primary key default gen_random_uuid(),
  payment_id     uuid not null references payments(id),
  amount_kobo    bigint not null,
  reason         text not null,
  status         text not null default 'to_approve' check (status in ('to_approve', 'approved', 'paid_out', 'declined')),
  decided_by     uuid,
  created_at     timestamptz not null default now()
);

-- ---------- Audit trail (append only) ----------

create table audit_log (
  id             bigint generated always as identity primary key,
  at             timestamptz not null default now(),
  actor          text not null,                   -- staff user id or 'system'
  action         text not null,
  item           text,
  details        jsonb
);

-- Entries can be added but never changed or removed.
create function audit_log_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append only';
end $$;

create trigger audit_log_no_update before update or delete on audit_log
  for each row execute function audit_log_immutable();

-- ---------- Row level security ----------
-- Turn RLS on for every table and add policies per role before going live.
alter table bookings enable row level security;
alter table payments enable row level security;
alter table customers enable row level security;
alter table memberships enable row level security;
alter table audit_log enable row level security;
