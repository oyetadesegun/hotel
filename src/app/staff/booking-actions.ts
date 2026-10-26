"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/db";
import { audit } from "@/src/lib/audit";
import { sendEmail } from "@/src/lib/mail";
import { requireStaff } from "@/src/lib/auth/session";
import { can, type Permission } from "@/src/lib/auth/roles";
import { dayStart, lagosDay } from "@/src/lib/bookings";
import { naira } from "@/src/lib/format";
import {
  activeMembershipOf,
  bookableDays,
  createBooking,
  customerFor,
  getPublicSetup,
  slotsFor,
  walkInPriceKobo,
  whenText,
  type Slot,
} from "@/src/lib/booking-engine";
import type { PaymentMethod } from "@/src/generated/prisma/client";

const clean = (v: unknown, max = 120) => String(v ?? "").trim().slice(0, max);
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const deskMethods: PaymentMethod[] = ["pos", "cash", "transfer"];

async function requirePermission(permission: Permission) {
  const me = await requireStaff();
  if (!can(me.staff.role, permission)) throw new Error("You do not have permission to do this.");
  return me;
}

/** Times for the desk booking screen. Staff can book further ahead than customers. */
export async function deskSlots(facilityId: string, day: string): Promise<Slot[]> {
  await requirePermission("bookAndVerify");
  const setup = await getPublicSetup();
  const f = setup.facilities.find((x) => x.id === facilityId);
  if (!f || !bookableDays(Math.max(f.bookAheadDays, setup.staffBookAheadDays)).includes(day)) return [];
  return slotsFor(facilityId, day);
}

export type MemberHit = { membershipId: string; name: string; number: string; phone: string | null; plan: string; endsOn: string | null };

/** Active members matching a name, membership number or phone. */
export async function findMembers(q: string): Promise<MemberHit[]> {
  await requirePermission("bookAndVerify");
  const term = clean(q, 60);
  if (term.length < 2) return [];
  const today = dayStart(lagosDay(new Date()));
  const rows = await prisma.membership.findMany({
    where: {
      status: "approved",
      OR: [{ endsOn: null }, { endsOn: { gte: today } }],
      AND: {
        OR: [
          { gymqNumber: { contains: term, mode: "insensitive" } },
          { customer: { fullName: { contains: term, mode: "insensitive" } } },
          { customer: { phone: { contains: term } } },
        ],
      },
    },
    include: { customer: true },
    orderBy: { customer: { fullName: "asc" } },
    take: 8,
  });
  return rows.map((m) => ({
    membershipId: m.id,
    name: m.customer.fullName,
    number: m.gymqNumber ?? "",
    phone: m.customer.phone,
    plan: m.category,
    endsOn: m.endsOn ? m.endsOn.toISOString().slice(0, 10) : null,
  }));
}

export type DeskBooking = {
  who: "member" | "resident" | "walkin";
  membershipId?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  roomNumber?: string;
  facilityId: string;
  start: string;
  rentalIds: string[];
  /** Walk-ins: pay now at the desk, or hold the slot until they pay. */
  pay?: "now" | "later";
  method?: string;
  receiptRef?: string;
};

/** Books at the desk for a member, resident guest or walk-in, then opens the booking. */
export async function deskBook(input: DeskBooking): Promise<{ error: string }> {
  const me = await requirePermission("bookAndVerify");
  let customerId: string;
  let label: string;
  let email: string | null = null;

  if (input.who === "member") {
    const m = await prisma.membership.findUnique({ where: { id: clean(input.membershipId, 40) }, include: { customer: true } });
    const active = m ? await activeMembershipOf(m.customerId) : null;
    if (!m || !active || active.id !== m.id) return { error: "Please choose an active member." };
    customerId = m.customerId;
    label = `Member ${m.gymqNumber ?? ""}`.trim();
    email = m.customer.email;
  } else {
    const fullName = clean(input.fullName);
    const phone = clean(input.phone, 40);
    const mail = clean(input.email).toLowerCase();
    const room = clean(input.roomNumber, 20);
    if (!fullName || !phone) return { error: "Please enter the customer's name and phone." };
    if (mail && !isEmail(mail)) return { error: "Please enter a valid email, or leave it empty." };
    if (input.who === "resident" && !room) return { error: "Please enter the room number." };
    const c = await customerFor({
      kind: input.who === "resident" ? "resident_guest" : "walk_in",
      fullName,
      phone,
      email: mail || null,
      roomNumber: input.who === "resident" ? room : null,
    });
    customerId = c.id;
    label = input.who === "resident" ? `Resident guest, room ${room}` : "Walk-in";
    email = mail || null;
  }

  const walkIn = input.who === "walkin";
  const payNow = walkIn && input.pay === "now";
  const method = clean(input.method, 20) as PaymentMethod;
  if (payNow && !deskMethods.includes(method)) return { error: "Please choose how they paid." };

  const result = await createBooking({
    facilityId: input.facilityId,
    start: input.start,
    rentalIds: Array.isArray(input.rentalIds) ? input.rentalIds.map(String) : [],
    customerId,
    channel: "desk",
    createdBy: me.accountId,
    status: walkIn && !payNow ? "reserved" : "booked",
    chargeFacility: walkIn,
    payment: payNow ? { method, receiptRef: clean(input.receiptRef, 60) || null, recordedBy: me.accountId } : undefined,
  });
  if ("error" in result) return result;

  const when = whenText(result.startsAt, result.endsAt);
  await audit(me.accountId, payNow ? "Booked at desk and paid" : walkIn ? "Booked at desk, unpaid hold" : "Booked at desk", result.code, {
    facility: result.facility,
    when,
    who: label,
    ...(payNow ? { amount: naira(Number(result.amountKobo) / 100), method } : {}),
  });
  if (email) {
    await sendEmail({
      to: email,
      subject: `Booking confirmed: ${result.facility}, ${when} (${result.code})`,
      text: `You are booked for ${result.facility}, ${when}.\nBooking code: ${result.code}\n\nShow this code at the Recreation desk. Please arrive 10 minutes early.`,
    });
  }
  revalidatePath("/staff", "layout");
  redirect(`/staff/bookings/${result.code}?new=1`);
}

/**
 * Things staff do to a booking: check in, mark a no-show, cancel, take payment for an unpaid hold,
 * and confirm a resident guest's stay.
 */
export async function updateBooking(_: unknown, fd: FormData): Promise<{ error?: string; ok?: string } | undefined> {
  const me = await requireStaff();
  if (!can(me.staff.role, "bookAndVerify")) return { error: "You do not have permission to do this." };
  const code = clean(fd.get("code"), 20);
  const op = clean(fd.get("op"), 20);
  const b = await prisma.booking.findUnique({ where: { code }, include: { payments: { where: { status: "succeeded" } }, customer: true } });
  if (!b) return { error: "Booking not found." };
  const now = new Date();

  switch (op) {
    case "check_in": {
      if (b.status !== "booked") return { error: "Only a booked, paid-up session can be checked in." };
      if (lagosDay(b.startsAt) !== lagosDay(now)) return { error: "Check in on the day of the booking." };
      await prisma.booking.update({ where: { id: b.id }, data: { status: "used" } });
      await audit(me.accountId, "Checked in", code);
      break;
    }
    case "no_show": {
      if (b.status !== "booked") return { error: "Only a booked session can be marked as a no-show." };
      if (b.startsAt > now) return { error: "A no-show can be marked once the session has started." };
      await prisma.booking.update({ where: { id: b.id }, data: { status: "no_show" } });
      await audit(me.accountId, "Marked no-show", code);
      break;
    }
    case "cancel": {
      if (b.status !== "booked" && b.status !== "reserved") return { error: "This booking can no longer be cancelled." };
      if (b.payments.length && !can(me.staff.role, "cancelPaidBooking")) return { error: "Only an admin can cancel a paid booking." };
      const reason = clean(fd.get("reason"), 200);
      await prisma.booking.update({ where: { id: b.id }, data: { status: "cancelled" } });
      await audit(me.accountId, "Booking cancelled", code, { reason: reason || "none given", paid: b.payments.length > 0 });
      break;
    }
    case "take_payment": {
      if (b.status !== "reserved") return { error: "Only an unpaid hold needs payment." };
      const method = clean(fd.get("method"), 20) as PaymentMethod;
      if (!deskMethods.includes(method)) return { error: "Please choose how they paid." };
      const amountKobo = await walkInPriceKobo(b.id);
      if (amountKobo == null) return { error: "The walk-in price for this facility is not set." };
      await prisma.$transaction([
        prisma.payment.create({
          data: { bookingId: b.id, method, status: "succeeded", amountKobo, receiptRef: clean(fd.get("receiptRef"), 60) || null, recordedBy: me.accountId },
        }),
        prisma.booking.update({ where: { id: b.id }, data: { status: "booked", holdExpiresAt: null } }),
      ]);
      await audit(me.accountId, "Payment taken at desk", code, { amount: naira(Number(amountKobo) / 100), method });
      break;
    }
    case "guest_ok": {
      if (b.customer.kind !== "resident_guest") return { error: "This is not a resident guest booking." };
      await prisma.booking.update({ where: { id: b.id }, data: { guestCheckedAt: now, guestCheckedBy: me.accountId } });
      await audit(me.accountId, "Resident guest confirmed", code, { room: b.customer.roomNumber ?? "" });
      break;
    }
    default:
      return { error: "Unknown action." };
  }
  revalidatePath("/staff", "layout");
  const back = clean(fd.get("back"), 200);
  if (back.startsWith("/staff")) redirect(back);
  return { ok: "Done." };
}
