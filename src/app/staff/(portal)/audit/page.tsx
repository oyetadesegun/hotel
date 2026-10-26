import type { Metadata } from "next";
import { prisma } from "@/src/lib/db";
import { requireStaffCan } from "@/src/lib/auth/session";
import { dateTime } from "@/src/lib/format";
import { Button, inputClass } from "@/src/components/ui";
import { Empty, PageTitle, TableCard } from "@/src/components/staff";
import { Table } from "@/src/components/table";

export const metadata: Metadata = { title: "Audit trail" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaffCan("seeReports");
  const { q = "" } = await searchParams;
  const search = q.trim();

  const entries = await prisma.auditLog.findMany({
    where: search
      ? { OR: [{ action: { contains: search, mode: "insensitive" } }, { item: { contains: search, mode: "insensitive" } }] }
      : {},
    orderBy: { at: "desc" },
    take: 300,
  });

  // Show staff names instead of ids.
  const staffIds = [...new Set(entries.map((e) => e.actor).filter((a) => /^[0-9a-f-]{36}$/.test(a)))];
  const staff = await prisma.staffUser.findMany({ where: { id: { in: staffIds } }, select: { id: true, fullName: true } });
  const names = new Map(staff.map((s) => [s.id, s.fullName]));
  const who = (actor: string) =>
    actor === "system" ? "System" : actor.startsWith("member:") ? "Member" : actor.startsWith("customer:") ? "Customer (online)" : (names.get(actor) ?? "Staff user");

  return (
    <>
      <PageTitle title="Audit trail" sub="Everything staff, members and the system did. Entries cannot be edited or deleted." />
      <TableCard>
        <form className="flex flex-wrap items-center gap-2.5">
          <input name="q" defaultValue={search} aria-label="Search" placeholder="Search action, email or reference" className={inputClass + " h-[46px] max-w-sm"} />
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
        {entries.length === 0 ? (
          <Empty>{search ? `Nothing matches “${search}”.` : "No activity yet."}</Empty>
        ) : (
          <Table
            heads={["When", "Who", "Action", "Item", "Details"]}
            rows={entries.map((e) => [
              dateTime(e.at),
              who(e.actor),
              e.action,
              e.item ?? "-",
              <span key="d" className="text-xs text-charcoal">
                {e.details && typeof e.details === "object"
                  ? Object.entries(e.details as Record<string, unknown>)
                      .map(([k, v]) => `${k}: ${String(v)}`)
                      .join(", ")
                  : ""}
              </span>,
            ])}
          />
        )}
      </TableCard>
    </>
  );
}
