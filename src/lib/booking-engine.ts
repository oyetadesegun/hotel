import "server-only";

import { randomInt } from "node:crypto";
import { cacheTag } from "next/cache";
import { prisma } from "@/src/lib/db";
import { dayStart, lagosDay } from "@/src/lib/bookings";
import { Prisma, type BookingStatus, type CustomerKind, type PaymentMethod } from "@/src/generated/prisma/client";

/*
 * The booking engine: what can be booked, the rules, and creating bookings.
 * Everything here runs on the server. Prices, slots and rules always come from
 * the database, never from the browser. The database itself refuses double
 * bookings (exclusion constraint "no_double_booking").
 */

const DAY = 86_400_000;
const MINUTE = 60_000;

// ---------- Setup the booking screens need ----------

export type PublicRental = { id: string; name: string; rateKobo: number };
export type PublicFacility = {
  id: string;
  slug: string;
  name: string;
  sessionMinutes: number;
  opens: string; // "07:00"
  closes: string; // "24:00"
  bookAheadDays: number;
  maxSessionsPerDay: number;
  walkInRateKobo: number | null;
  rentals: PublicRental[];
};
export type PublicSetup = {
  facilities: PublicFacility[];
  holdUnpaidHours: number;
  sessionsPer24h: number;
  staffBookAheadDays: number;
};

const hhmm = (d: Date) => d.toISOString().slice(11, 16);
/** Minutes after midnight for a `time` column. A 24:00 closing time reads back as 00:00. */
const minutesOf = (d: Date, closing = false) => {
  const m = d.getUTCHours() * 60 + d.getUTCMinutes();
  return closing && m === 0 ? 1440 : m;
};

async function settingNumber(key: string, fallback: number) {
  const s = await prisma.setting.findUnique({ where: { key } });
  return typeof s?.value === "number" ? s.value : fallback;
}

/** Facilities open for booking, their rental items and the booking rules. Cached until an admin changes the setup. */
export async function getPublicSetup(): Promise<PublicSetup> {
  "use cache";
  cacheTag("setup");
  const [facilities, holdUnpaidHours, sessionsPer24h, staffBookAheadDays] = await Promise.all([
    prisma.facility.findMany({
      where: { active: true },
      include: { rentalItems: { where: { active: true }, orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    settingNumber("hold_unpaid_hours", 12),
    settingNumber("sessions_per_24h", 2),
    settingNumber("staff_book_ahead_days", 30),
  ]);
  return {
    holdUnpaidHours,
    sessionsPer24h,
    staffBookAheadDays,
    facilities: facilities.map((f) => ({
      id: f.id,
      slug: f.slug,
      name: f.name,
      sessionMinutes: f.sessionMinutes,
      opens: hhmm(f.opensAt),
      closes: minutesOf(f.closesAt, true) === 1440 ? "24:00" : hhmm(f.closesAt),
      bookAheadDays: f.bookAheadDays,
      maxSessionsPerDay: f.maxSessionsPerDay,
      walkInRateKobo: f.walkInRateKobo == null ? null : Number(f.walkInRateKobo),
      rentals: f.rentalItems.map((r) => ({ id: r.id, name: r.name, rateKobo: Number(r.ratePerHourKobo) })),
    })),
  };
}

// ---------- Days and slots ----------

/** The days someone can book, as YYYY-MM-DD in Lagos, starting today. At least today. */
export function bookableDays(aheadDays: number, now = new Date()): string[] {
  const today = dayStart(lagosDay(now));
  return Array.from({ length: Math.max(1, aheadDays) }, (_, i) => lagosDay(new Date(today.getTime() + i * DAY + 2 * 3_600_000)));
}

export type SlotState = "free" | "taken" | "held" | "past";
export type Slot = { start: string; label: string; end: string; state: SlotState };

/** Unpaid holds whose time is up are released, so their slot can be booked again. */
export async function releaseExpiredHolds() {
  const expired = await prisma.booking.updateManyAndReturn({
    where: { status: "reserved", holdExpiresAt: { lt: new Date() } },
    data: { status: "expired" },
    select: { code: true },
  });
  if (expired.length) {
    await prisma.auditLog.createMany({
      data: expired.map((b) => ({ actor: "system", action: "Unpaid hold expired", item: b.code })),
    });
  }
}

const LIVE: BookingStatus[] = ["reserved", "booked", "used"];

/** Every session start for a facility on a day, with whether it can still be booked. */
export async function slotsFor(facilityId: string, day: string): Promise<Slot[]> {
  const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
  if (!facility || !facility.active || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return [];
  await releaseExpiredHolds();

  const start = dayStart(day);
  const open = minutesOf(facility.opensAt);
  const close = minutesOf(facility.closesAt, true);
  const bookings = await prisma.booking.findMany({
    where: {
      facilityId,
      status: { in: LIVE },
      startsAt: { lt: new Date(start.getTime() + close * MINUTE) },
      endsAt: { gt: new Date(start.getTime() + open * MINUTE) },
    },
    select: { startsAt: true, endsAt: true, status: true },
  });

  const now = Date.now();
  const slots: Slot[] = [];
  for (let m = open; m + facility.sessionMinutes <= close; m += facility.sessionMinutes) {
    const s = new Date(start.getTime() + m * MINUTE);
    const e = new Date(s.getTime() + facility.sessionMinutes * MINUTE);
    const clash = bookings.find((b) => b.startsAt < e && b.endsAt > s);
    const state: SlotState = s.getTime() <= now ? "past" : clash ? (clash.status === "reserved" ? "held" : "taken") : "free";
    const label = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
    slots.push({ start: s.toISOString(), label: label(m), end: label(m + facility.sessionMinutes), state });
  }
  return slots;
}

// ---------- Who is booking ----------

/** An approved membership that has not ended, for its membership (GymQ) number. */
export async function findActiveMember(memberNumber: string) {
  const number = memberNumber.trim();
  if (!number) return null;
  const today = dayStart(lagosDay(new Date()));
  const m = await prisma.membership.findFirst({
    where: { gymqNumber: { equals: number, mode: "insensitive" }, status: "approved" },
    include: { customer: true },
  });
  if (!m || (m.endsOn && m.endsOn < today)) return null;
  return m;
}

/** The signed-in member's active membership, if they have one. */
export async function activeMembershipOf(customerId: string) {
  const today = dayStart(lagosDay(new Date()));
  return prisma.membership.findFirst({
    where: { customerId, status: "approved", OR: [{ endsOn: null }, { endsOn: { gte: today } }] },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Finds the customer record to book under, or makes one.
 * Walk-ins and resident guests are matched on phone (and room), so the session limits apply to the person.
 */
export async function customerFor(input: {
  kind: Exclude<CustomerKind, "member">;
  fullName: string;
  phone: string;
  email?: string | null;
  roomNumber?: string | null;
}) {
  const existing = await prisma.customer.findFirst({
    where: {
      kind: input.kind,
      phone: input.phone,
      ...(input.kind === "resident_guest" ? { roomNumber: input.roomNumber } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  const data = { fullName: input.fullName, email: input.email || existing?.email || null, roomNumber: input.roomNumber ?? null };
  return existing
    ? prisma.customer.update({ where: { id: existing.id }, data })
    : prisma.customer.create({ data: { kind: input.kind, phone: input.phone, ...data } });
}

// ---------- Creating a booking ----------

export type NewBooking = {
  facilityId: string;
  start: string; // ISO time of the slot, from slotsFor
  rentalIds: string[];
  customerId: string;
  /** "online" applies the customer's book-ahead window. Staff get the longer staff window. */
  channel: "online" | "desk";
  createdBy?: string | null;
  status: "booked" | "reserved";
  /** A payment to record with the booking (walk-ins). */
  payment?: { method: PaymentMethod; gatewayRef?: string; receiptRef?: string | null; recordedBy?: string | null };
  /** Online walk-ins pay for the whole booking; members and resident guests pay rentals at the desk. */
  chargeFacility: boolean;
};

export type BookingResult =
  | { error: string }
  | { ok: true; code: string; facility: string; startsAt: Date; endsAt: Date; amountKobo: bigint; rentals: string[] };

const codeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => {
  const part = (n: number, chars: string) => Array.from({ length: n }, () => chars[randomInt(chars.length)]).join("");
  return `BK-${part(4, codeChars)}-${part(4, "0123456789")}`;
};

function isDoubleBooking(e: unknown) {
  const text = e instanceof Error ? e.message : String(e);
  return text.includes("no_double_booking") || text.includes("23P01") || text.includes("exclusion");
}

export async function createBooking(b: NewBooking): Promise<BookingResult> {
  const facility = await prisma.facility.findUnique({
    where: { id: b.facilityId },
    include: { rentalItems: { where: { active: true } } },
  });
  if (!facility || !facility.active) return { error: "This facility is not open for booking." };

  // The slot must be one the engine offers: on the facility's grid, in the future and in the booking window.
  const startsAt = new Date(b.start);
  if (Number.isNaN(startsAt.getTime())) return { error: "Please pick a time." };
  const day = lagosDay(startsAt);
  const setup = await getPublicSetup();
  const ahead = b.channel === "online" ? facility.bookAheadDays : Math.max(facility.bookAheadDays, setup.staffBookAheadDays);
  if (!bookableDays(ahead).includes(day)) return { error: "This day cannot be booked yet." };
  const slot = (await slotsFor(facility.id, day)).find((s) => s.start === startsAt.toISOString());
  if (!slot) return { error: "Please pick one of the times shown." };
  if (slot.state === "past") return { error: "This time has already started. Please pick a later one." };
  if (slot.state !== "free") return { error: "Someone has just taken this time. Please pick another." };
  const endsAt = new Date(startsAt.getTime() + facility.sessionMinutes * MINUTE);

  // Session limits for this person at this facility.
  const [sameDay, around] = await Promise.all([
    prisma.booking.count({
      where: { customerId: b.customerId, facilityId: facility.id, status: { in: LIVE }, startsAt: { gte: dayStart(day), lt: new Date(dayStart(day).getTime() + DAY) } },
    }),
    prisma.booking.count({
      where: {
        customerId: b.customerId,
        facilityId: facility.id,
        status: { in: LIVE },
        startsAt: { gt: new Date(startsAt.getTime() - DAY), lt: new Date(startsAt.getTime() + DAY) },
      },
    }),
  ]);
  if (sameDay >= facility.maxSessionsPerDay) {
    return { error: `${facility.name} allows ${facility.maxSessionsPerDay} session${facility.maxSessionsPerDay === 1 ? "" : "s"} per person a day, and this person has reached it.` };
  }
  if (around >= setup.sessionsPer24h) {
    return { error: `Only ${setup.sessionsPer24h} sessions per person, per facility, in 24 hours. This person has reached it.` };
  }

  const rentals = facility.rentalItems.filter((r) => b.rentalIds.includes(r.id));
  const hours = facility.sessionMinutes / 60;
  const rentalKobo = rentals.reduce((sum, r) => sum + BigInt(Math.round(Number(r.ratePerHourKobo) * hours)), BigInt(0));
  let amountKobo = BigInt(0);
  if (b.chargeFacility) {
    if (facility.walkInRateKobo == null) return { error: `The walk-in price for ${facility.name} is not set yet. Please ask the Recreation desk.` };
    amountKobo = facility.walkInRateKobo + rentalKobo;
  }

  const holdHours = setup.holdUnpaidHours;
  const terms = await prisma.termsVersion.findFirst({ where: { publishedAt: { not: null } }, orderBy: { publishedAt: "desc" } });

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    try {
      await prisma.$transaction(async (tx) => {
        const booking = await tx.booking.create({
          data: {
            code,
            facilityId: facility.id,
            customerId: b.customerId,
            startsAt,
            endsAt,
            status: b.status,
            holdExpiresAt: b.status === "reserved" ? new Date(Math.min(Date.now() + holdHours * 3_600_000, startsAt.getTime())) : null,
            termsVersion: terms?.version ?? null,
            createdBy: b.createdBy ?? null,
            rentals: { create: rentals.map((r) => ({ rentalItemId: r.id, quantity: 1, ratePerHourKobo: r.ratePerHourKobo })) },
          },
        });
        if (b.payment) {
          await tx.payment.create({
            data: {
              bookingId: booking.id,
              method: b.payment.method,
              status: "succeeded",
              amountKobo,
              gatewayRef: b.payment.gatewayRef ?? null,
              receiptRef: b.payment.receiptRef ?? null,
              recordedBy: b.payment.recordedBy ?? null,
            },
          });
        }
      });
      return { ok: true, code, facility: facility.name, startsAt, endsAt, amountKobo, rentals: rentals.map((r) => r.name) };
    } catch (e) {
      if (isDoubleBooking(e)) return { error: "Someone has just taken this time. Please pick another." };
      // A clash on the booking code: try another one.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  return { error: "Could not create the booking. Please try again." };
}

/** What a walk-in owes for a booking: the facility's walk-in rate plus its rentals at the rates kept on the booking. */
export async function walkInPriceKobo(bookingId: string): Promise<bigint | null> {
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, include: { facility: true, rentals: true } });
  if (!b || b.facility.walkInRateKobo == null) return null;
  const hours = (b.endsAt.getTime() - b.startsAt.getTime()) / 3_600_000;
  return b.rentals.reduce(
    (sum, r) => sum + BigInt(Math.round(Number(r.ratePerHourKobo) * hours)) * BigInt(r.quantity),
    b.facility.walkInRateKobo,
  );
}

/** "Mon 26 Oct, 18:00 to 19:00" in Lagos time. */
export function whenText(startsAt: Date, endsAt: Date) {
  const t = (d: Date) => d.toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" });
  const d = startsAt.toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short" });
  return `${d}, ${t(startsAt)} to ${t(endsAt)}`;
}
