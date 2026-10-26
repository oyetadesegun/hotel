import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/src/lib/db";
import { requireStaff } from "@/src/lib/auth/session";
import { can } from "@/src/lib/auth/roles";
import { naira } from "@/src/lib/format";
import { toNaira } from "@/src/lib/membership";
import { Card, Chip } from "@/src/components/ui";
import { Col, Cols, Empty, KpiCard, PageTitle, TableCard } from "@/src/components/staff";
import { Table } from "@/src/components/table";

export const metadata: Metadata = { title: "Dashboard" };

const lagosDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default async function DashboardPage() {
  const me = await requireStaff();
  const now = new Date();
  const startOfDay = new Date(now.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }) + "T00:00:00+01:00");
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
  const startOfMonth = new Date(startOfDay);
  startOfMonth.setDate(1);

  const [toReview, profilePending, cardsToPrint, activeMembers, monthPayments, reconcile, todaysBookings, facilities] =
    await Promise.all([
      prisma.membership.count({ where: { status: "paid_waiting_review" } }),
      prisma.membership.count({ where: { status: "profile_pending" } }),
      prisma.membership.count({ where: { status: "approved", cardIssuedAt: null } }),
      prisma.membership.count({ where: { status: "approved", endsOn: { gte: startOfDay } } }),
      prisma.payment.aggregate({
        where: { status: "succeeded", createdAt: { gte: startOfMonth } },
        _sum: { amountKobo: true },
        _count: true,
      }),
      prisma.payment.count({ where: { status: "needs_reconciling" } }),
      prisma.booking.findMany({
        where: { startsAt: { gte: startOfDay, lt: endOfDay }, status: { in: ["reserved", "booked", "used"] } },
        include: { facility: true, customer: true },
        orderBy: { startsAt: "asc" },
      }),
      prisma.facility.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    ]);

  // Money figures are for admins only.
  const seesMoney = can(me.staff.role, "seeReports");

  const attention = [
    toReview > 0 && { tone: "bg-info-bg", head: "text-info-fg", title: `${toReview} membership application${toReview > 1 ? "s" : ""}`, body: "Paid, waiting for review", href: "/staff/applications?tab=review", cta: "Review" },
    cardsToPrint > 0 && { tone: "bg-warn-bg", head: "text-warn-fg", title: `${cardsToPrint} card${cardsToPrint > 1 ? "s" : ""} to print`, body: "Approved, physical card not issued yet", href: "/staff/applications?tab=print", cta: "Open" },
    profilePending > 0 && { tone: "bg-warn-bg", head: "text-warn-fg", title: `${profilePending} profile${profilePending > 1 ? "s" : ""} not finished`, body: "Paid online, application form not completed", href: "/staff/applications?tab=pending", cta: "Open" },
    seesMoney && reconcile > 0 && { tone: "bg-bad-bg", head: "text-bad-fg", title: `${reconcile} payment${reconcile > 1 ? "s" : ""} to reconcile`, body: "Money taken without a matching booking", href: "/staff/reconcile", cta: "Reconcile" },
  ].filter(Boolean) as { tone: string; head: string; title: string; body: string; href: string; cta: string }[];

  return (
    <>
      <PageTitle title={`Hello, ${me.staff.fullName.split(" ")[0]}`} sub={lagosDate(now)} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Applications to review" value={String(toReview)} note={`${profilePending} more waiting for the applicant's profile`} />
        <KpiCard label="Active members" value={String(activeMembers)} note={`${cardsToPrint} card${cardsToPrint === 1 ? "" : "s"} to print`} />
        {seesMoney && (
        <KpiCard
          label="Payments this month"
          value={naira(toNaira(monthPayments._sum.amountKobo ?? BigInt(0)))}
          note={`${monthPayments._count} payment${monthPayments._count === 1 ? "" : "s"} received`}
        />
        )}
        <KpiCard label="Bookings today" value={String(todaysBookings.length)} note={`Across ${facilities.length} facilities`} />
      </div>
      <Cols>
        <Col grow={2} basis={520}>
          <TableCard>
            <h2 className="text-base font-bold">Today&apos;s sessions</h2>
            {todaysBookings.length === 0 ? (
              <Empty>No bookings today.</Empty>
            ) : (
              <Table
                heads={["Time", "Facility", "Customer", "Status"]}
                rows={todaysBookings.map((b) => [
                  b.startsAt.toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" }),
                  b.facility.name,
                  b.customer.fullName,
                  <Chip key="s" tone={b.status === "reserved" ? "warn" : "ok"}>{b.status}</Chip>,
                ])}
              />
            )}
          </TableCard>
        </Col>
        <Col basis={300}>
          <Card>
            <h2 className="text-base font-bold">Needs attention</h2>
            {attention.length === 0 && <Empty>Nothing needs attention right now.</Empty>}
            {attention.map((a) => (
              <div key={a.title} className={`rounded-xl p-3 text-[13px] leading-relaxed ${a.tone}`}>
                <b className={a.head}>{a.title}</b>
                <br />
                {a.body}
                <br />
                <Link href={a.href} className="font-bold underline">
                  {a.cta}
                </Link>
              </div>
            ))}
          </Card>
        </Col>
      </Cols>
    </>
  );
}
