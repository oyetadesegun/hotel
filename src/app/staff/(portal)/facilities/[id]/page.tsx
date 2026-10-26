import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/src/lib/db";
import { requireStaffCan } from "@/src/lib/auth/session";
import { Button, Card, Divider, Notice } from "@/src/components/ui";
import { Col, Cols, Empty, PageTitle } from "@/src/components/staff";
import { AddRentalItemForm, FacilityForm, RentalItemForm } from "@/src/components/FacilityForms";

export const metadata: Metadata = { title: "Edit facility" };

export default async function EditFacilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ added?: string }>;
}) {
  await requireStaffCan("changeSetup");
  const [{ id }, { added }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const facility = await prisma.facility.findUnique({
    where: { id },
    include: { rentalItems: { orderBy: { name: "asc" } }, _count: { select: { bookings: true } } },
  });
  if (!facility) notFound();

  return (
    <>
      <PageTitle title={facility.name} sub="Sessions, opening hours, limits and what can be rented here.">
        <Button href="/staff/facilities" variant="secondary" size="md" className="h-11 text-sm">
          All facilities
        </Button>
      </PageTitle>
      {added && <Notice tone="ok">{facility.name} has been added. Add its rental items below, if it has any.</Notice>}
      <Cols>
        <Col grow={3} basis={520}>
          <Card>
            <h2 className="text-base font-bold">Facility details</h2>
            <FacilityForm facility={facility} />
            {facility._count.bookings > 0 && (
              <p className="text-xs text-charcoal">
                Changes apply to new bookings. The {facility._count.bookings} booking{facility._count.bookings === 1 ? "" : "s"} already
                made keep their times. To stop new bookings, untick “Open for booking”.
              </p>
            )}
          </Card>
        </Col>
        <Col grow={2} basis={340}>
          <Card>
            <h2 className="text-base font-bold">Rental items</h2>
            {facility.rentalItems.length === 0 ? (
              <Empty>Nothing to rent here yet.</Empty>
            ) : (
              facility.rentalItems.map((item, i) => (
                <div key={item.id} className="flex flex-col gap-3.5">
                  {i > 0 && <Divider />}
                  <RentalItemForm facilityId={facility.id} item={item} />
                </div>
              ))
            )}
            <Divider />
            <h3 className="text-sm font-bold">Add a rental item</h3>
            <AddRentalItemForm facilityId={facility.id} />
          </Card>
        </Col>
      </Cols>
    </>
  );
}
