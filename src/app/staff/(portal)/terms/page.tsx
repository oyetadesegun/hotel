import type { Metadata } from "next";
import { prisma } from "@/src/lib/db";
import { requireStaff } from "@/src/lib/auth/session";
import { dateTime } from "@/src/lib/format";
import { Button, Chip, Notice } from "@/src/components/ui";
import { Empty, PageTitle, TableCard } from "@/src/components/staff";
import { Table } from "@/src/components/table";

export const metadata: Metadata = { title: "Terms and conditions" };

export default async function StaffTermsPage() {
  await requireStaff();
  const versions = await prisma.termsVersion.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { bookings: true } } },
  });

  return (
    <>
      <PageTitle title="Terms and conditions" sub="Each booking keeps the version of the terms the customer accepted.">
        <Button href="/terms" variant="secondary" size="md" className="h-11 text-sm">
          See the customer page
        </Button>
      </PageTitle>
      <TableCard>
        {versions.length === 0 ? (
          <Empty>No versions are stored in the database yet. The customer terms page shows the text written in the code.</Empty>
        ) : (
          <Table
            heads={["Version", "Status", "Published", "Accepted on bookings"]}
            rows={versions.map((v) => [
              <b key="v">{v.version}</b>,
              <Chip key="s" tone={v.publishedAt ? "ok" : "warn"}>{v.publishedAt ? "Published" : "Draft"}</Chip>,
              dateTime(v.publishedAt),
              String(v._count.bookings),
            ])}
          />
        )}
      </TableCard>
      <Notice>Editing and publishing terms from this page is not built yet.</Notice>
    </>
  );
}
