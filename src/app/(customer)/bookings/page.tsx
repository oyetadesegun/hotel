import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { BottomNav } from "@/src/components/BottomNav";
import { BookingsList, type BookingItem } from "@/src/components/BookingsList";
import { Button, Notice } from "@/src/components/ui";
import { AsideCard, PillLink, WebPage, WithAside } from "@/src/components/web";
import { prisma } from "@/src/lib/db";
import { getSignedIn } from "@/src/lib/auth/session";
import { bookingStatusLabel, bookingStatusTone, lagosTime } from "@/src/lib/bookings";

export const metadata: Metadata = { title: "My bookings" };

export default function MyBookingsPage() {
  return (
    <>
      <WebPage
        eyebrow="MY BOOKINGS"
        title="Your time"
        accent="on court."
        sub="Upcoming sessions, payments to finish and your booking codes, all in one place."
      >
        <WithAside
          aside={
            <>
              <AsideCard dark title="Fancy another game?">
                <p className="text-sm leading-relaxed text-white/75">Courts and halls, booked in a minute.</p>
                <PillLink href="/?book=1" className="mt-1 self-start">
                  Book a facility <ArrowRight size={16} aria-hidden="true" />
                </PillLink>
              </AsideCard>
              <AsideCard title="Good to know">
                <ul className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-charcoal">
                  <li>Free bookings can be cancelled up to 2 hours before the slot.</li>
                  <li>A paid booking that is not used is not refunded.</li>
                </ul>
                <Link href="/terms" className="text-[13px] font-bold text-link hover:underline">
                  Read the terms and conditions
                </Link>
              </AsideCard>
            </>
          }
        >
          <Suspense fallback={<p className="text-sm text-charcoal">Loading your bookings…</p>}>
            <Bookings />
          </Suspense>
        </WithAside>
      </WebPage>
      <BottomNav />
    </>
  );
}

async function Bookings() {
  const me = await getSignedIn();
  if (!me?.customerId) {
    return (
      <div className="flex flex-col gap-3">
        <Notice>Members: sign in to see your bookings.</Notice>
        <Button href="/login" className="self-start">
          Sign in
        </Button>
      </div>
    );
  }

  const now = new Date();
  const rows = await prisma.booking.findMany({
    where: { customerId: me.customerId },
    include: { facility: true, rentals: { include: { rentalItem: true } } },
    orderBy: { startsAt: "desc" },
    take: 100,
  });
  if (rows.length === 0) return <Notice>You have no bookings yet.</Notice>;

  const f = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", ...o });
  const items: BookingItem[] = rows.map((b) => ({
    facility: b.facility.name,
    dow: f(b.startsAt, { weekday: "short" }),
    day: Number(f(b.startsAt, { day: "numeric" })),
    month: f(b.startsAt, { month: "short" }),
    time: `${lagosTime(b.startsAt)} to ${lagosTime(b.endsAt)}`,
    extra: b.rentals.length ? `with ${b.rentals.map((r) => r.rentalItem.name.toLowerCase()).join(" and ")}` : undefined,
    status: bookingStatusLabel[b.status],
    tone: bookingStatusTone[b.status],
    code: b.code,
    pay: b.status === "reserved",
    note: b.status === "reserved" ? "Not paid yet: pay at the Recreation desk before your session." : undefined,
    past: b.endsAt < now || ["cancelled", "expired", "used", "no_show"].includes(b.status),
  }));
  return <BookingsList items={items} />;
}
