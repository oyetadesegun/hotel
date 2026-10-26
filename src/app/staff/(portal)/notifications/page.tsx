import type { Metadata } from "next";
import { prisma } from "@/src/lib/db";
import { requireStaffCan } from "@/src/lib/auth/session";
import { dateTime } from "@/src/lib/format";
import { Chip, Notice } from "@/src/components/ui";
import { Empty, PageTitle, TableCard } from "@/src/components/staff";
import { Table } from "@/src/components/table";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  await requireStaffCan("manageUsers");
  const sent = await prisma.auditLog.findMany({ where: { action: "Email sent" }, orderBy: { at: "desc" }, take: 200 });
  const connected = Boolean(process.env.EMAIL_API_KEY);

  return (
    <>
      <PageTitle title="Notifications" sub="Emails the system has sent." />
      {!connected && (
        <Notice tone="warn">
          No email provider is connected yet, so emails are not delivered: they are printed in the server terminal instead. Add the
          provider&apos;s key as EMAIL_API_KEY and they start going out.
        </Notice>
      )}
      <TableCard>
        {sent.length === 0 ? (
          <Empty>No emails sent yet.</Empty>
        ) : (
          <Table
            heads={["When", "To", "Subject", "Delivery"]}
            rows={sent.map((e) => {
              const d = (e.details ?? {}) as { subject?: string; via?: string };
              return [
                dateTime(e.at),
                e.item ?? "-",
                d.subject ?? "-",
                <Chip key="v" tone={d.via === "provider" ? "ok" : "warn"}>
                  {d.via === "provider" ? "Sent" : "Not delivered (no provider)"}
                </Chip>,
              ];
            })}
          />
        )}
      </TableCard>
    </>
  );
}
