"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/db";
import { audit } from "@/src/lib/audit";
import { appUrl, sendEmail } from "@/src/lib/mail";
import { getSignedIn } from "@/src/lib/auth/session";
import { naira } from "@/src/lib/format";
import {
  activeMembershipOf,
  bookableDays,
  createBooking,
  customerFor,
  findActiveMember,
  getPublicSetup,
  slotsFor,
  whenText,
  type Slot,
} from "@/src/lib/booking-engine";

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const clean = (v: unknown, max = 120) => String(v ?? "").trim().slice(0, max);

/** Times for one facility and day, for the booking popup. */
export async function getSlots(facilityId: string, day: string): Promise<Slot[]> {
  const setup = await getPublicSetup();
  const facility = setup.facilities.find((f) => f.id === facilityId);
  if (!facility || !bookableDays(facility.bookAheadDays).includes(day)) return [];
  return slotsFor(facilityId, day);
}

/** Step 1 for members: checks the membership number before they pick a time. */
export async function checkMember(memberNumber: string): Promise<{ error: string } | { ok: true; name: string }> {
  const m = await findActiveMember(clean(memberNumber, 40));
  if (!m) return { error: "We could not find an active membership with this number. Check your card, or ask the Recreation desk." };
  return { ok: true, name: m.customer.fullName };
}

export type OnlineBooking = {
  who: "member" | "resident" | "walkin";
  memberNumber?: string;
  lastName?: string;
  roomNumber?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  facilityId: string;
  start: string;
  rentalIds: string[];
  acceptTerms: boolean;
};

export type OnlineResult =
  | { error: string }
  | { ok: true; code: string; facility: string; when: string; rentals: string[]; paidKobo: number; free: boolean; guestCheck: boolean };

/**
 * Books a session from the website.
 * Members and resident guests book free. Walk-ins pay online: in test mode (PAYMENT_MODE=test)
 * the payment is recorded as a TEST payment straight away; with RedPay this becomes
 * "reserve, open RedPay, confirm from the webhook".
 */
export async function bookOnline(input: OnlineBooking): Promise<OnlineResult> {
  if (!input.acceptTerms) return { error: "Please accept the terms and conditions." };
  const phone = clean(input.phone, 40);
  const email = clean(input.email).toLowerCase();
  if (email && !isEmail(email)) return { error: "Please enter a valid email, or leave it empty." };

  let customerId: string;
  let customerEmail: string | null = email || null;
  let name: string;

  if (input.who === "member") {
    const me = await getSignedIn();
    const mine = me?.kind === "member" && me.customerId ? await activeMembershipOf(me.customerId) : null;
    const m = mine && (!input.memberNumber || input.memberNumber === mine.gymqNumber)
      ? mine
      : await findActiveMember(clean(input.memberNumber, 40));
    if (!m) return { error: "We could not find an active membership with this number." };
    customerId = m.customerId;
    customerEmail = m.customer.email;
    name = m.customer.fullName;
  } else {
    const lastName = clean(input.lastName, 60);
    // Resident guests give their room number and last name; a full name is optional.
    const fullName = clean(input.fullName) || (input.who === "resident" ? lastName : "");
    if (input.who === "resident" && !lastName) return { error: "Please enter your last name." };
    if (!fullName) return { error: "Please enter your full name." };
    if (!phone) return { error: "Please enter your phone number." };
    if (input.who === "walkin" && !isEmail(email)) return { error: "Please enter your email, so we can send your booking code." };
    const room = clean(input.roomNumber, 20);
    if (input.who === "resident" && !room) return { error: "Please enter your room number." };
    if (input.who === "walkin" && process.env.PAYMENT_MODE !== "test") {
      return { error: "Online payment is not connected yet. Please book at the Recreation desk." };
    }
    const customer = await customerFor({
      kind: input.who === "resident" ? "resident_guest" : "walk_in",
      fullName,
      phone,
      email: email || null,
      roomNumber: input.who === "resident" ? room : null,
    });
    customerId = customer.id;
    name = fullName;
  }
  const auditActor = input.who === "member" ? `member:${customerId}` : `customer:${customerId}`;

  const walkIn = input.who === "walkin";
  const result = await createBooking({
    facilityId: input.facilityId,
    start: input.start,
    rentalIds: Array.isArray(input.rentalIds) ? input.rentalIds.map(String) : [],
    customerId,
    channel: "online",
    status: "booked",
    chargeFacility: walkIn,
    payment: walkIn ? { method: "online", gatewayRef: `TEST-${randomBytes(6).toString("hex").toUpperCase()}` } : undefined,
  });
  if ("error" in result) return result;

  const when = whenText(result.startsAt, result.endsAt);
  await audit(auditActor, walkIn ? "Booked and paid online" : "Booked online", result.code, {
    facility: result.facility,
    when,
    who: input.who === "resident" ? `Resident guest, room ${clean(input.roomNumber, 20)}` : input.who === "member" ? "Member" : "Walk-in",
    ...(walkIn ? { amountKobo: result.amountKobo.toString(), mode: "test" } : {}),
  });

  if (customerEmail) {
    await sendEmail({
      to: customerEmail,
      subject: `Booking confirmed: ${result.facility}, ${when} (${result.code})`,
      text: [
        `Hello ${name},`,
        "",
        `You are booked for ${result.facility}, ${when}.`,
        `Booking code: ${result.code}`,
        result.rentals.length ? `Equipment: ${result.rentals.join(", ")}` : "",
        walkIn ? `Paid: ${naira(Number(result.amountKobo) / 100)}` : "No charge for facility use.",
        !walkIn && result.rentals.length ? "Equipment is paid at the Recreation desk." : "",
        input.who === "resident" ? "Please bring your room key: reception confirms your stay when you arrive." : "",
        "",
        "Show this code at the Recreation desk. Please arrive 10 minutes early.",
        input.who === "member" ? `See your bookings: ${appUrl("/bookings")}` : "",
      ]
        .filter((l, i, all) => l !== "" || all[i - 1] !== "")
        .join("\n"),
    });
  }

  return {
    ok: true,
    code: result.code,
    facility: result.facility,
    when,
    rentals: result.rentals,
    paidKobo: Number(result.amountKobo),
    free: !walkIn,
    guestCheck: input.who === "resident",
  };
}

/** Members cancel their own free bookings up to 2 hours before the start. */
export async function cancelMyBooking(_: unknown, fd: FormData): Promise<{ error?: string } | undefined> {
  const me = await getSignedIn();
  if (!me?.customerId) return { error: "Please sign in again." };
  const code = clean(fd.get("code"), 20);
  const b = await prisma.booking.findUnique({ where: { code }, include: { payments: { where: { status: "succeeded" } } } });
  if (!b || b.customerId !== me.customerId) return { error: "Booking not found." };
  if (b.status !== "booked" && b.status !== "reserved") return { error: "This booking can no longer be cancelled." };
  if (b.payments.length) return { error: "Paid bookings are cancelled at the Recreation desk." };
  if (b.startsAt.getTime() - Date.now() < 2 * 3_600_000) return { error: "Bookings can be cancelled up to 2 hours before the start." };
  await prisma.booking.update({ where: { id: b.id }, data: { status: "cancelled" } });
  await audit(`member:${me.customerId}`, "Booking cancelled by member", code);
  redirect(`/bookings/${code}?cancelled=1`);
}
