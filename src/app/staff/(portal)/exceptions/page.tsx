import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/src/lib/db";
import { requireStaffCan } from "@/src/lib/auth/session";
import { daysAgo } from "@/src/lib/format";
import { Card } from "@/src/components/ui";
import { PageTitle } from "@/src/components/staff";

export const metadata: Metadata = { title: "Exceptions" };

export default async function ExceptionsPage() {
  await requireStaffCan("seeReports");
  const threeDaysAgo = daysAgo(3);
  const fourteenDaysAgo = daysAgo(14);
  const [reconcile, failed, overdueCards, staleProfiles] = await Promise.all([
    prisma.payment.count({ where: { status: "needs_reconciling" } }),
    prisma.payment.count({ where: { status: "failed", createdAt: { gte: fourteenDaysAgo } } }),
    prisma.membership.count({ where: { status: "approved", cardIssuedAt: null, startsOn: { lt: threeDaysAgo } } }),
    prisma.membership.count({ where: { status: "profile_pending", createdAt: { lt: threeDaysAgo } } }),
  ]);

  const items = [
    { label: "Payments to reconcile", n: reconcile, href: "/staff/reconcile" },
    { label: "Failed payments, last 14 days", n: failed, href: "/staff/payments?tab=attention" },
    { label: "Cards not issued after 3 days", n: overdueCards, href: "/staff/applications?tab=print" },
    { label: "Profiles unfinished after 3 days", n: staleProfiles, href: "/staff/applications?tab=pending" },
  ];

  return (
    <>
      <PageTitle title="Exceptions" sub="Things that did not go the normal way and need someone to look." />
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((i) => (
          <Link key={i.label} href={i.href}>
            <Card className={`gap-1 p-[18px] hover:shadow-sm ${i.n > 0 ? "ring-2 ring-warn-bg" : ""}`}>
              <span className="text-[13px] text-charcoal">{i.label}</span>
              <b className="text-3xl">{i.n}</b>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
