import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/src/lib/db";
import { requireStaff } from "@/src/lib/auth/session";
import { can } from "@/src/lib/auth/roles";
import { dateTime, naira } from "@/src/lib/format";
import { planText, toNaira } from "@/src/lib/membership";
import { Chip, Notice, cn, type Tone } from "@/src/components/ui";
import { Empty, PageTitle, TableCard } from "@/src/components/staff";
import { Table } from "@/src/components/table";
import type { PaymentStatus, Prisma } from "@/src/generated/prisma/client";

export const metadata: Metadata = { title: "Payments" };

const tone: Record<PaymentStatus, Tone> = {
  initiated: "warn",
  succeeded: "ok",
  failed: "bad",
  needs_reconciling: "bad",
  refunded: "neutral",
};
const label: Record<PaymentStatus, string> = {
  initiated: "Started, not finished",
  succeeded: "Paid",
  failed: "Failed",
  needs_reconciling: "Needs reconciling",
  refunded: "Refunded",
};

const tabs = {
  all: { label: "All", where: {} },
  memberships: { label: "Memberships", where: { membershipId: { not: null } } },
  bookings: { label: "Bookings", where: { bookingId: { not: null } } },
  attention: { label: "Needs attention", where: { status: { in: ["needs_reconciling", "failed"] } } },
} satisfies Record<string, { label: string; where: Prisma.PaymentWhereInput }>;
type Tab = keyof typeof tabs;

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await requireStaff();
  const { tab: t } = await searchParams;
  const tab: Tab = t && t in tabs ? (t as Tab) : "all";

  if (!can(me.staff.role, "seeReports")) {
    return (
      <>
        <PageTitle title="Payments" />
        <Notice>Payments are visible to admins only.</Notice>
      </>
    );
  }

  const payments = await prisma.payment.findMany({
    where: tabs[tab].where,
    include: { membership: { include: { customer: true } }, booking: { include: { customer: true, facility: true } }, recorder: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <>
      <PageTitle title="Payments" sub="Every payment received, online or at the desk." />
      <nav className="flex flex-wrap gap-2 text-sm font-semibold" aria-label="Filter payments">
        {(Object.keys(tabs) as Tab[]).map((key) => (
          <Link
            key={key}
            href={`/staff/payments?tab=${key}`}
            aria-current={key === tab ? "page" : undefined}
            className={cn("flex h-10 items-center rounded-full px-4", key === tab ? "bg-charcoal text-white" : "bg-white hover:bg-neutral-bg")}
          >
            {tabs[key].label}
          </Link>
        ))}
      </nav>
      <TableCard>
        {payments.length === 0 ? (
          <Empty>No payments here yet.</Empty>
        ) : (
          <Table
            heads={["When", "For", "Customer", "Amount", "Method", "Reference", "Status"]}
            rows={payments.map((p) => {
              const customer = p.membership?.customer ?? p.booking?.customer;
              return [
                dateTime(p.createdAt),
                p.membership ? (
                  <Link key="f" href={`/staff/applications?tab=all&id=${p.membership.id}`} className="font-bold text-link hover:underline">
                    {p.membership.applicationRef} · {planText(p.membership.category, p.membership.duration)}
                  </Link>
                ) : p.booking ? (
                  <Link key="f" href={`/staff/bookings/${p.booking.code}`} className="font-bold text-link hover:underline">
                    {p.booking.code} · {p.booking.facility.name}
                  </Link>
                ) : (
                  "-"
                ),
                customer?.fullName ?? "-",
                naira(toNaira(p.amountKobo)),
                p.method === "online" ? "Online" : p.method.toUpperCase(),
                <span key="r" className="text-xs">
                  {p.gatewayRef ?? p.receiptRef ?? "-"}
                  {p.gatewayRef?.startsWith("TEST-") && <span className="ml-1 text-warn-fg">(test)</span>}
                </span>,
                <Chip key="s" tone={tone[p.status]}>{label[p.status]}</Chip>,
              ];
            })}
          />
        )}
        <p className="text-xs leading-relaxed text-charcoal">
          Payments taken without a matching booking are flagged for Finance. Repeated gateway messages never create a second payment.
        </p>
      </TableCard>
    </>
  );
}
