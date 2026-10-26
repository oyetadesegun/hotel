import type { Metadata } from "next";
import { prisma } from "@/src/lib/db";
import { requireStaff } from "@/src/lib/auth/session";
import { naira } from "@/src/lib/format";
import { toNaira } from "@/src/lib/membership";
import { Button, Chip, Notice } from "@/src/components/ui";
import { can } from "@/src/lib/auth/roles";
import { timeOf } from "@/src/lib/facilities";
import { Empty, PageTitle, TableCard } from "@/src/components/staff";
import { Table } from "@/src/components/table";

export const metadata: Metadata = { title: "Facilities and rentals" };

export default async function FacilitiesPage() {
  const me = await requireStaff();
  const canEdit = can(me.staff.role, "changeSetup");
  const facilities = await prisma.facility.findMany({ include: { rentalItems: true }, orderBy: { name: "asc" } });
  const rentals = facilities.flatMap((f) => f.rentalItems.map((r) => ({ ...r, facilityName: f.name })));

  return (
    <>
      <PageTitle title="Facilities and rental items" sub="What can be booked, when, and what it costs. Members and resident guests are not charged for facility use.">
        {canEdit && (
          <Button href="/staff/facilities/new" size="md" className="h-11 text-sm">
            Add facility
          </Button>
        )}
      </PageTitle>
      <TableCard>
        <h2 className="text-base font-bold">Facilities</h2>
        {facilities.length === 0 ? (
          <Empty>No facilities set up.</Empty>
        ) : (
          <Table
            heads={["Facility", "Session", "Open", "Max per day", "Book ahead", "Walk-in rate", "Status", ...(canEdit ? [""] : [])]}
            rows={facilities.map((f) => [
              <b key="n">{f.name}</b>,
              `${f.sessionMinutes} min`,
              `${timeOf(f.opensAt)} to ${timeOf(f.closesAt, true)}`,
              String(f.maxSessionsPerDay),
              `${f.bookAheadDays} days`,
              f.walkInRateKobo == null ? <Chip key="r" tone="warn">Not set</Chip> : naira(toNaira(f.walkInRateKobo)),
              <Chip key="s" tone={f.active ? "ok" : "neutral"}>{f.active ? "Open for booking" : "Closed"}</Chip>,
              ...(canEdit
                ? [
                    <Button key="e" href={`/staff/facilities/${f.id}`} variant="secondary" size="sm">
                      Edit
                    </Button>,
                  ]
                : []),
            ])}
          />
        )}
      </TableCard>
      <TableCard>
        <h2 className="text-base font-bold">Rental items</h2>
        {rentals.length === 0 ? (
          <Empty>No rental items set up.</Empty>
        ) : (
          <Table
            heads={["Item", "Offered at", "Rate per hour", "Status"]}
            rows={rentals.map((r) => [
              <b key="i">{r.name}</b>,
              r.facilityName,
              naira(toNaira(r.ratePerHourKobo)),
              <Chip key="s" tone={r.active ? "ok" : "neutral"}>{r.active ? "Active" : "Off"}</Chip>,
            ])}
          />
        )}
      </TableCard>
      {canEdit ? (
        <p className="text-xs text-charcoal">Rental items are changed on each facility’s Edit page.</p>
      ) : (
        <Notice>Only an admin can change facilities, sessions and prices.</Notice>
      )}
    </>
  );
}
