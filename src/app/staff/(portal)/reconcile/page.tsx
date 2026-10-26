import type { Metadata } from "next";
import { prisma } from "@/src/lib/db";
import { requireStaffCan } from "@/src/lib/auth/session";
import { dateTime, naira } from "@/src/lib/format";
import { toNaira } from "@/src/lib/membership";
import { Notice } from "@/src/components/ui";
import { Empty, PageTitle, TableCard } from "@/src/components/staff";
import { Table } from "@/src/components/table";

export const metadata: Metadata = { title: "Reconcile payments" };

export default async function ReconcilePage() {
  await requireStaffCan("seeReports");
  const payments = await prisma.payment.findMany({
    where: { status: "needs_reconciling" },
    include: { booking: { include: { customer: true } }, membership: { include: { customer: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <>
      <PageTitle title="Reconcile payments" sub="Money that was taken but did not complete a booking or membership." />
      <TableCard>
        {payments.length === 0 ? (
          <Empty>Nothing to reconcile.</Empty>
        ) : (
          <Table
            heads={["Paid at", "Reference", "Amount", "Customer", "For"]}
            rows={payments.map((p) => [
              dateTime(p.createdAt),
              p.gatewayRef ?? p.receiptRef ?? "-",
              naira(toNaira(p.amountKobo)),
              (p.booking?.customer ?? p.membership?.customer)?.fullName ?? "-",
              p.booking?.code ?? p.membership?.applicationRef ?? "-",
            ])}
          />
        )}
      </TableCard>
      <Notice>
        Payments land here when the gateway reports money for something that already expired. That starts happening once RedPay is
        connected; test payments never need reconciling.
      </Notice>
    </>
  );
}
