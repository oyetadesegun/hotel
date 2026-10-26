"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/db";
import { audit } from "@/src/lib/audit";
import { requireStaff } from "@/src/lib/auth/session";
import { can } from "@/src/lib/auth/roles";
import { halfHours, koboFromInput, minutesOf, rateCategories, ruleFields, sessionLengths, slugify } from "@/src/lib/facilities";
import { MembershipDuration } from "@/src/generated/prisma/client";
import type { FormState } from "./actions";

const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function requireAdmin() {
  const me = await requireStaff();
  if (!can(me.staff.role, "changeSetup")) throw new Error("Only an admin can change the setup.");
  return me;
}

/** Whole number in a range, or null when it is not one. */
function intIn(raw: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= min && n <= max ? n : null;
}

/** Setup changes show on customer pages too (prices, opening hours). */
function refresh() {
  updateTag("setup");
  revalidatePath("/", "layout");
}

// ---------- Facilities ----------

export async function saveFacility(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const id = field(fd, "id");
  const name = field(fd, "name");
  const sessionMinutes = Number(field(fd, "sessionMinutes"));
  const opens = field(fd, "opensAt");
  const closes = field(fd, "closesAt");
  const maxSessionsPerDay = intIn(field(fd, "maxSessionsPerDay"), 1, 48);
  const bookAheadDays = intIn(field(fd, "bookAheadDays"), 0, 365);
  const walkInRateKobo = koboFromInput(field(fd, "walkInRate"));
  const active = fd.get("active") === "on";

  if (!name) return { error: "Please enter the facility name." };
  if (!(sessionLengths as readonly number[]).includes(sessionMinutes)) return { error: "Please choose a session length." };
  if (!halfHours.includes(opens) || !halfHours.includes(closes)) return { error: "Please choose opening and closing times." };
  if (minutesOf(closes) - minutesOf(opens) < sessionMinutes) {
    return { error: "Closing time must be at least one session after opening time." };
  }
  if (maxSessionsPerDay == null) return { error: "Sessions per person per day must be a whole number from 1 to 48." };
  if (bookAheadDays == null) return { error: "Book ahead must be a whole number of days, from 0 to 365." };
  if (walkInRateKobo === undefined) return { error: "Walk-in rate must be an amount in naira, or left empty." };

  const clash = await prisma.facility.findFirst({ where: { name: { equals: name, mode: "insensitive" }, NOT: id ? { id } : undefined } });
  if (clash) return { error: `There is already a facility called ${clash.name}.` };

  const data = { name, sessionMinutes, maxSessionsPerDay, bookAheadDays, walkInRateKobo, active };

  const saved = await prisma.$transaction(async (tx) => {
    let facility;
    if (id) {
      facility = await tx.facility.update({ where: { id }, data });
    } else {
      // A short, unique web name for links, e.g. "padel-2".
      const base = slugify(name);
      let slug = base;
      for (let n = 2; await tx.facility.findUnique({ where: { slug } }); n++) slug = `${base}-${n}`;
      facility = await tx.facility.create({ data: { ...data, slug } });
    }
    // `time` columns are written as text so a 24:00 closing time is kept as it is.
    await tx.$executeRaw`UPDATE "facilities" SET "opens_at" = ${opens}::time, "closes_at" = ${closes}::time WHERE "id" = ${facility.id}::uuid`;
    return facility;
  });

  await audit(me.accountId, id ? "Facility changed" : "Facility added", name, {
    session: `${sessionMinutes} min`,
    hours: `${opens} to ${closes}`,
    maxPerDay: maxSessionsPerDay,
    bookAheadDays,
    walkInRate: walkInRateKobo == null ? "not set" : String(Number(walkInRateKobo) / 100),
    status: active ? "open" : "closed",
  });
  refresh();
  if (!id) redirect(`/staff/facilities/${saved.id}?added=1`);
  return { ok: "Saved." };
}

// ---------- Rental items ----------

export async function saveRentalItem(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const id = field(fd, "id");
  const facilityId = field(fd, "facilityId");
  const name = field(fd, "name");
  const rate = koboFromInput(field(fd, "rate"));
  const active = id ? fd.get("active") === "on" : true;

  if (!name) return { error: "Please enter the item name." };
  if (rate == null) return { error: "Please enter the rate per hour in naira." };

  const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
  if (!facility) return { error: "That facility no longer exists." };
  const clash = await prisma.rentalItem.findFirst({
    where: { facilityId, name: { equals: name, mode: "insensitive" }, NOT: id ? { id } : undefined },
  });
  if (clash) return { error: `${facility.name} already has an item called ${clash.name}.` };

  if (id) {
    await prisma.rentalItem.update({ where: { id }, data: { name, ratePerHourKobo: rate, active } });
  } else {
    await prisma.rentalItem.create({ data: { facilityId, name, ratePerHourKobo: rate } });
  }
  await audit(me.accountId, id ? "Rental item changed" : "Rental item added", `${facility.name}: ${name}`, {
    ratePerHour: String(Number(rate) / 100),
    status: active ? "active" : "off",
  });
  refresh();
  return { ok: id ? "Saved." : `${name} added.` };
}

// ---------- Booking rules ----------

export async function saveBookingRules(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const values: Record<string, number> = {};
  for (const r of ruleFields) {
    const n = intIn(field(fd, r.key), r.min, r.max);
    if (n == null) return { error: `${r.label}: enter a whole number from ${r.min} to ${r.max}.` };
    values[r.key] = n;
  }
  const fee = koboFromInput(field(fd, "application_form_fee"));
  if (fee == null) return { error: "Printed application form fee: enter an amount in naira." };
  values.application_form_fee_kobo = Number(fee);

  await prisma.$transaction(
    Object.entries(values).map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, update: { value, updatedBy: me.accountId }, create: { key, value, updatedBy: me.accountId } }),
    ),
  );
  await audit(me.accountId, "Booking rules changed", null, values);
  refresh();
  return { ok: "Booking rules saved." };
}

// ---------- Membership rates ----------

const durations = Object.values(MembershipDuration);

/**
 * Saves a full rate card from an effective date. Earlier rows stay, so payments
 * already made keep the price that was charged. An empty box means "agreed per company".
 */
export async function saveMembershipRates(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const from = field(fd, "effectiveFrom");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return { error: "Please choose the date the new rates start." };
  const effectiveFrom = new Date(`${from}T00:00:00Z`);
  const today = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }) + "T00:00:00Z");
  if (effectiveFrom < today) return { error: "New rates can start today or later, not in the past." };

  const rows: { category: string; duration: MembershipDuration; priceKobo: bigint | null }[] = [];
  for (const category of rateCategories) {
    for (const duration of durations) {
      const price = koboFromInput(field(fd, `${category}|${duration}`));
      if (price === undefined) return { error: `${category}, ${duration}: enter an amount in naira or leave it empty.` };
      rows.push({ category, duration, priceKobo: price });
    }
  }

  await prisma.$transaction(
    rows.map((r) =>
      prisma.membershipRate.upsert({
        where: { category_duration_effectiveFrom: { category: r.category, duration: r.duration, effectiveFrom } },
        update: { priceKobo: r.priceKobo },
        create: { ...r, effectiveFrom },
      }),
    ),
  );
  await audit(me.accountId, "Membership rates set", from, {
    rates: rows.filter((r) => r.priceKobo != null).length,
  });
  refresh();
  return { ok: `Rates saved. They apply from ${effectiveFrom.toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" })}.` };
}
