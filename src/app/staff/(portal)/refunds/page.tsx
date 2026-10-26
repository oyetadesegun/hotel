import type { Metadata } from "next";
import { prisma } from "@/src/lib/db";
import { requireStaffCan } from "@/src/lib/auth/session";
import { dateTime, naira } from "@/src/lib/format";
import { toNaira } from "@/src/lib/membership";
import { Chip, type Tone } from "@/src/components/ui";
import { Empty, PageTitle, TableCard } from "@/src/components/staff";
import { Table } from "@/src/components/table";
import type { RefundStatus } from "@/src/generated/prisma/client";

export const metadata: Metadata = { title: "Refunds" };

const tone: Record<RefundStatus, Tone> = { to_approve: "warn", approved: "info", paid_out: "ok", declined: "neutral" };
const label: Record<RefundStatus, string> = { to_approve: "To approve", approved: "Approved", paid_out: "Paid out", declined: "Declined" };

export default async function RefundsPage() {
  await requireStaffCan("approveRefunds");
  const refunds = await prisma.refund.findMany({
    include: {
      decider: true,
      payment: { include: { booking: { include: { customer: true } }, membership: { include: { customer: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <>
      <PageTitle title="Refunds" />
      <TableCard>
        {refunds.length === 0 ? (
          <Empty>No refunds requested.</Empty>
        ) : (
          <Table
            heads={["For", "Customer", "Amount", "Reason", "Requested", "Decided by", "Status"]}
            rows={refunds.map((r) => {
              const p = r.payment;
              return [
                p.booking?.code ?? p.membership?.applicationRef ?? "-",
                (p.booking?.customer ?? p.membership?.customer)?.fullName ?? "-",
                naira(toNaira(r.amountKobo)),
                r.reason,
                dateTime(r.createdAt),
                r.decider?.fullName ?? "-",
                <Chip key="s" tone={tone[r.status]}>{label[r.status]}</Chip>,
              ];
            })}
          />
        )}
        <p className="text-xs text-charcoal">
          A paid booking that is not used is not refunded. Refunds are approved by an admin or the Hotel, and each one is
          logged.
        </p>
      </TableCard>
    </>
  );
}
