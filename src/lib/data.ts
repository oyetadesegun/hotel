/**
 * Sample data used while the screens are being built.
 * Every list here is meant to come from the database (see supabase/schema.sql),
 * because facilities, rental items, prices and rules must be editable by an administrator.
 */

import type { Permission } from "@/src/lib/auth/roles";

export type Facility = {
  id: string;
  name: string;
  open: string;
  close: string;
  session: string;
  maxPerDay: number;
  bookAhead: string;
  /** Walk-in price per session. null until the Hotel confirms court tariffs. */
  walkInRate: number | null;
};

export const facilities: Facility[] = [
  { id: "padel", name: "Padel", open: "07:00", close: "24:00", session: "1 hour", maxPerDay: 2, bookAhead: "1 week", walkInRate: null },
  { id: "tennis", name: "Tennis", open: "07:00", close: "24:00", session: "1 hour", maxPerDay: 2, bookAhead: "1 week", walkInRate: null },
  { id: "squash", name: "Squash", open: "07:00", close: "24:00", session: "1 hour", maxPerDay: 2, bookAhead: "1 week", walkInRate: null },
  { id: "badminton", name: "Badminton", open: "07:00", close: "24:00", session: "1 hour", maxPerDay: 2, bookAhead: "1 week", walkInRate: null },
];

export type RentalItem = {
  id: string;
  item: string;
  facilityId: string;
  perHour: number;
};

export const rentals: RentalItem[] = [
  { id: "padel-racket", item: "Racket", facilityId: "padel", perHour: 5000 },
  { id: "padel-balls", item: "Balls", facilityId: "padel", perHour: 5000 },
  { id: "tennis-racket", item: "Racket", facilityId: "tennis", perHour: 7000 },
  { id: "squash-racket", item: "Racket", facilityId: "squash", perHour: 7000 },
  { id: "badminton-racket", item: "Racket", facilityId: "badminton", perHour: 7000 },
];

export type MembershipRate = {
  category: string;
  annual: number | null;
  m6: number | null;
  m3: number | null;
  m1: number | null;
};

/** 2026 rate card, effective 1 April 2026. Corporate is agreed per company. */
export const membershipRates: MembershipRate[] = [
  { category: "Individual", annual: 902000, m6: 568000, m3: 355000, m1: 216000 },
  { category: "Couple", annual: 1430000, m6: 902000, m3: 568000, m1: 355000 },
  { category: "Family", annual: 2300000, m6: 1430000, m3: 902000, m1: 568000 },
  { category: "Extra child", annual: 568000, m6: 355000, m3: 216000, m1: 120000 },
  { category: "Corporate", annual: null, m6: null, m3: null, m1: null },
];

export const durations = [
  { key: "m1", label: "1 month" },
  { key: "m3", label: "3 months" },
  { key: "m6", label: "6 months" },
  { key: "annual", label: "Annual" },
] as const;

/** Charged only for the printed form that first-time members buy. */
export const APPLICATION_FORM_FEE = 20000;

export const bookingRules = {
  sessionsPer24h: 2,
  holdUnpaidHours: 12,
  customerBookAhead: "1 week",
  staffBookAhead: "1 month",
  opens: "07:00",
  closes: "24:00",
};

export type StaffNavGroup = {
  group: string;
  /** Roles without this permission do not see the group. Unset: every staff role sees it. */
  perm?: Permission;
  items: { label: string; href: string; also?: string[] }[];
};

/** Shown on its own above the groups. */
export const staffHome = { label: "Dashboard", href: "/staff" };

export const staffNav: StaffNavGroup[] = [
  {
    group: "Bookings",
    perm: "bookAndVerify",
    items: [
      { label: "Calendar", href: "/staff/calendar" },
      { label: "New booking", href: "/staff/bookings/new", also: ["/staff/bookings/walk-in"] },
      { label: "Verify a booking", href: "/staff/verify" },
    ],
  },
  {
    group: "Payments",
    perm: "seeReports",
    items: [
      { label: "Payments", href: "/staff/payments", also: ["/staff/reconcile"] },
      { label: "Refunds", href: "/staff/refunds" },
    ],
  },
  {
    group: "Members",
    perm: "approveMembership",
    items: [
      { label: "Applications", href: "/staff/applications" },
      { label: "Member register", href: "/staff/members" },
      { label: "Guest checks", href: "/staff/guest-checks" },
    ],
  },
  {
    group: "Facilities and pricing",
    items: [
      { label: "Facilities and rentals", href: "/staff/facilities" },
      { label: "Rates and rules", href: "/staff/rates" },
      { label: "Terms and conditions", href: "/staff/terms" },
    ],
  },
  {
    group: "System",
    perm: "manageUsers",
    items: [
      { label: "Users and roles", href: "/staff/users" },
      { label: "Notifications", href: "/staff/notifications" },
      { label: "Integrations", href: "/staff/integrations" },
    ],
  },
  {
    group: "Oversight",
    perm: "seeReports",
    items: [
      { label: "Exceptions", href: "/staff/exceptions" },
      { label: "Reports", href: "/staff/reports" },
      { label: "Audit trail", href: "/staff/audit" },
    ],
  },
];
