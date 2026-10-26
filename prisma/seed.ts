/**
 * Loads the setup data an administrator would otherwise type in: facilities,
 * rental items, the 2026 membership rate card and booking settings.
 * Safe to run more than once (every write is an upsert).
 *
 * Run with: npm run db:seed
 */
import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, MembershipDuration } from "../src/generated/prisma/client";
import {
  APPLICATION_FORM_FEE,
  bookingRules,
  facilities,
  membershipRates,
  rentals,
} from "../src/lib/data";

loadEnvConfig(process.cwd());

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, options: "-c TimeZone=UTC" }),
});

/** Prices in data.ts are in naira; the database stores kobo. */
const kobo = (naira: number | null) => (naira === null ? null : BigInt(naira) * BigInt(100));

const durationKeys = { m1: MembershipDuration.m1, m3: MembershipDuration.m3, m6: MembershipDuration.m6, annual: MembershipDuration.annual } as const;

async function main() {
  for (const f of facilities) {
    const data = {
      name: f.name,
      maxSessionsPerDay: f.maxPerDay,
      walkInRateKobo: kobo(f.walkInRate),
    };
    await prisma.facility.upsert({ where: { slug: f.id }, update: data, create: { slug: f.id, ...data } });
  }

  const facilityIds = new Map(
    (await prisma.facility.findMany({ select: { id: true, slug: true } })).map((f) => [f.slug, f.id]),
  );

  for (const r of rentals) {
    const facilityId = facilityIds.get(r.facilityId)!;
    const ratePerHourKobo = kobo(r.perHour)!;
    await prisma.rentalItem.upsert({
      where: { facilityId_name: { facilityId, name: r.item } },
      update: { ratePerHourKobo },
      create: { facilityId, name: r.item, ratePerHourKobo },
    });
  }

  const effectiveFrom = new Date("2026-04-01");
  for (const rate of membershipRates) {
    for (const [key, duration] of Object.entries(durationKeys)) {
      const priceKobo = kobo(rate[key as keyof typeof durationKeys]);
      await prisma.membershipRate.upsert({
        where: { category_duration_effectiveFrom: { category: rate.category, duration, effectiveFrom } },
        update: { priceKobo },
        create: { category: rate.category, duration, effectiveFrom, priceKobo },
      });
    }
  }

  const settings: Record<string, number> = {
    hold_unpaid_hours: bookingRules.holdUnpaidHours,
    sessions_per_24h: bookingRules.sessionsPer24h,
    staff_book_ahead_days: 30,
    application_form_fee_kobo: Number(kobo(APPLICATION_FORM_FEE)),
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }

  console.log(
    `Seeded ${facilities.length} facilities, ${rentals.length} rental items, ` +
      `${membershipRates.length * 4} membership rates, ${Object.keys(settings).length} settings.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
