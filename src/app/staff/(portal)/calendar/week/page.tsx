import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/src/lib/db";
import { requireStaff } from "@/src/lib/auth/session";
import { bookingStatusTone, dayStart, lagosDay, lagosTime } from "@/src/lib/bookings";
import { Button, Card, Chip } from "@/src/components/ui";
import { PageTitle } from "@/src/components/staff";

export const metadata: Metadata = { title: "Calendar, week" };

export default async function WeekPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireStaff();
  const { date } = await searchParams;
  const anchor = dayStart(date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : lagosDay(new Date()));
  // Week starts on Monday.
  const weekday = (anchor.getUTCDay() + 6) % 7;
  const start = new Date(anchor.getTime() - weekday * 86_400_000);
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 86_400_000));
  const end = new Date(start.getTime() + 7 * 86_400_000);
  const iso = (d: Date) => lagosDay(new Date(d.getTime() + 3_600_000));

  const bookings = await prisma.booking.findMany({
    where: { startsAt: { gte: start, lt: end }, status: { notIn: ["cancelled", "expired"] } },
    include: { facility: true, customer: true },
    orderBy: { startsAt: "asc" },
  });
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", ...o });

  return (
    <>
      <PageTitle title="Calendar, week">
        <span className="flex gap-1 rounded-[10px] bg-white p-1 text-sm font-semibold">
          <Link href={`/staff/calendar?date=${iso(anchor)}`} className="rounded-lg px-4 py-2.5">
            Day
          </Link>
          <span className="rounded-lg bg-charcoal px-4 py-2.5 text-white">Week</span>
        </span>
      </PageTitle>
      <Card className="overflow-x-auto p-4">
        <div className="flex items-center justify-between gap-3">
          <Button href={`/staff/calendar/week?date=${iso(new Date(start.getTime() - 7 * 86_400_000))}`} variant="secondary" size="sm">
            Previous
          </Button>
          <b>
            {fmt(days[0], { day: "numeric", month: "short" })} to {fmt(days[6], { day: "numeric", month: "short", year: "numeric" })}
          </b>
          <Button href={`/staff/calendar/week?date=${iso(end)}`} variant="secondary" size="sm">
            Next
          </Button>
        </div>
        <div className="grid min-w-[860px] grid-cols-7 gap-2">
          {days.map((d) => {
            const list = bookings.filter((b) => lagosDay(b.startsAt) === iso(d));
            return (
              <div key={d.toISOString()} className="flex min-h-40 flex-col gap-1.5 rounded-xl bg-surface p-2">
                <Link href={`/staff/calendar?date=${iso(d)}`} className="text-[13px] font-bold hover:underline">
                  {fmt(d, { weekday: "short", day: "numeric" })}
                </Link>
                {list.length === 0 && <span className="text-xs text-charcoal">No bookings</span>}
                {list.map((b) => (
                  <Link key={b.id} href={`/staff/bookings/${b.code}`}>
                    <Chip tone={bookingStatusTone[b.status]} className="block truncate rounded text-[11px]">
                      {lagosTime(b.startsAt)} {b.facility.name.slice(0, 3).toUpperCase()} {b.customer.fullName.split(" ")[0]}
                    </Chip>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}
