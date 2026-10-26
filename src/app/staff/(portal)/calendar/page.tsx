import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/src/lib/db";
import { requireStaff } from "@/src/lib/auth/session";
import { bookingStatusLabel, bookingStatusTone, dayStart, lagosDay, lagosHour } from "@/src/lib/bookings";
import { BackIcon, Card, Chip } from "@/src/components/ui";
import { PageTitle } from "@/src/components/staff";

export const metadata: Metadata = { title: "Calendar" };

const HOURS = Array.from({ length: 17 }, (_, i) => 7 + i);

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireStaff();
  const { date } = await searchParams;
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : lagosDay(new Date());
  const start = dayStart(day);
  const end = new Date(start.getTime() + 86_400_000);
  const shift = (days: number) => lagosDay(new Date(start.getTime() + days * 86_400_000 + 3_600_000));

  const [facilities, bookings] = await Promise.all([
    prisma.facility.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.booking.findMany({
      where: { startsAt: { gte: start, lt: end }, status: { notIn: ["cancelled", "expired"] } },
      include: { customer: true },
    }),
  ]);

  return (
    <>
      <PageTitle title="Calendar">
        <Link href={`/staff/calendar?date=${shift(-1)}`} aria-label="Previous day" className="flex size-11 items-center justify-center rounded-[10px] bg-white text-charcoal">
          <BackIcon size={20} />
        </Link>
        <span className="flex h-11 items-center rounded-[10px] bg-white px-4 text-sm font-bold">
          {start.toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", year: "numeric" })}
        </span>
        <Link href={`/staff/calendar?date=${shift(1)}`} aria-label="Next day" className="flex size-11 rotate-180 items-center justify-center rounded-[10px] bg-white text-charcoal">
          <BackIcon size={20} />
        </Link>
        <span className="flex gap-1 rounded-[10px] bg-white p-1 text-sm font-semibold">
          <span className="rounded-lg bg-charcoal px-4 py-2.5 text-white">Day</span>
          <Link href={`/staff/calendar/week?date=${day}`} className="rounded-lg px-4 py-2.5">
            Week
          </Link>
        </span>
      </PageTitle>
      <Card className="overflow-x-auto p-4">
        <div style={{ minWidth: 120 + facilities.length * 140 }}>
          <div
            className="grid h-10 items-center border-b border-line text-[13px] font-bold"
            style={{ gridTemplateColumns: `64px repeat(${facilities.length}, minmax(0, 1fr))` }}
          >
            <span />
            {facilities.map((f) => (
              <span key={f.id} className="pl-1.5">
                {f.name}
              </span>
            ))}
          </div>
          <div
            className="grid"
            style={{
              gridTemplateColumns: `64px repeat(${facilities.length}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${HOURS.length}, 44px)`,
              backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 43px, #ededed 43px, #ededed 44px)",
            }}
          >
            {HOURS.map((h, i) => (
              <span key={h} style={{ gridColumn: 1, gridRow: i + 1 }} className="pl-1.5 pt-1 text-xs text-charcoal">
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
            {bookings.map((b) => {
              const col = facilities.findIndex((f) => f.id === b.facilityId);
              const row = HOURS.indexOf(lagosHour(b.startsAt));
              if (col < 0 || row < 0) return null;
              return (
                <Link
                  key={b.id}
                  href={`/staff/bookings/${b.code}`}
                  style={{ gridColumn: col + 2, gridRow: row + 1 }}
                  className="m-0.5 flex flex-col justify-center overflow-hidden rounded-md bg-white px-2 text-xs shadow-sm ring-1 ring-line"
                >
                  <b className="truncate">{b.customer.fullName}</b>
                  <Chip tone={bookingStatusTone[b.status]} className="self-start px-1.5 py-0 text-[10px]">
                    {bookingStatusLabel[b.status]}
                  </Chip>
                </Link>
              );
            })}
          </div>
        </div>
        {bookings.length === 0 && <p className="pt-3 text-center text-sm text-charcoal">No bookings on this day.</p>}
      </Card>
    </>
  );
}
