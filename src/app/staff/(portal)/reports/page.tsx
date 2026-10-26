import type { Metadata } from "next";
import { prisma } from "@/src/lib/db";
import { requireStaff } from "@/src/lib/auth/session";
import { can } from "@/src/lib/auth/roles";
import { naira } from "@/src/lib/format";
import { toNaira } from "@/src/lib/membership";
import { Card, Notice } from "@/src/components/ui";
import { Col, Cols, Empty, KpiCard, PageTitle, TableCard } from "@/src/components/staff";
import { Table } from "@/src/components/table";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const me = await requireStaff();
  if (!can(me.staff.role, "seeReports")) {
    return (
      <>
        <PageTitle title="Reports" />
        <Notice>Reports are visible to admins only.</Notice>
      </>
    );
  }

  const since = new Date();
  since.setMonth(since.getMonth() - 11, 1);
  since.setHours(0, 0, 0, 0);

  const [payments, byCategory, statusCounts] = await Promise.all([
    prisma.payment.findMany({
      where: { status: "succeeded", createdAt: { gte: since } },
      select: { amountKobo: true, createdAt: true, membershipId: true, gatewayRef: true },
    }),
    prisma.membership.groupBy({ by: ["category"], where: { status: { in: ["approved", "paid_waiting_review"] } }, _count: true }),
    prisma.membership.groupBy({ by: ["status"], _count: true }),
  ]);

  const months = new Map<string, { kobo: bigint; count: number }>();
  for (const p of payments) {
    const key = p.createdAt.toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", month: "short", year: "numeric" });
    const m = months.get(key) ?? { kobo: BigInt(0), count: 0 };
    m.kobo += p.amountKobo;
    m.count += 1;
    months.set(key, m);
  }
  const total = payments.reduce((s, p) => s + p.amountKobo, BigInt(0));
  const testOnly = payments.length > 0 && payments.every((p) => p.gatewayRef?.startsWith("TEST-"));
  const count = (s: string) => statusCounts.find((c) => c.status === s)?._count ?? 0;

  return (
    <>
      <PageTitle title="Reports" sub="Last 12 months." />
      {testOnly && <Notice tone="warn">All payments so far are test payments: no real money has moved.</Notice>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Received, 12 months" value={naira(toNaira(total))} note={`${payments.length} payments`} />
        <KpiCard label="Approved memberships" value={String(count("approved"))} note="All time" />
        <KpiCard label="Waiting for review" value={String(count("paid_waiting_review"))} note="Paid, profile done" />
        <KpiCard label="Rejected" value={String(count("rejected"))} note="All time" />
      </div>
      <Cols>
        <Col grow={2} basis={480}>
          <TableCard>
            <h2 className="text-base font-bold">Money received by month</h2>
            {months.size === 0 ? (
              <Empty>No payments yet.</Empty>
            ) : (
              <Table
                heads={["Month", "Payments", "Amount"]}
                rows={[...months.entries()].map(([m, v]) => [m, String(v.count), naira(toNaira(v.kobo))])}
              />
            )}
          </TableCard>
        </Col>
        <Col basis={300}>
          <Card as="aside">
            <h2 className="text-base font-bold">Members by category</h2>
            {byCategory.length === 0 ? (
              <Empty>No members yet.</Empty>
            ) : (
              <Table heads={["Category", "Members"]} rows={byCategory.map((c) => [c.category, String(c._count)])} />
            )}
          </Card>
        </Col>
      </Cols>
    </>
  );
}
