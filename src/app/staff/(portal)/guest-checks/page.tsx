import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/src/lib/db";
import { requireStaffCan } from "@/src/lib/auth/session";
import { lagosTime } from "@/src/lib/bookings";
import { ActionForm } from "@/src/components/ActionForm";
import { Notice } from "@/src/components/ui";
import { Empty, PageTitle, TableCard } from "@/src/components/staff";
import { Table } from "@/src/components/table";
import { updateBooking } from "@/src/app/staff/booking-actions";

export const metadata: Metadata = { title: "Guest checks" };

export default async function GuestChecksPage() {
  await requireStaffCan("bookAndVerify");
  const waiting = await prisma.booking.findMany({
    where: {
      customer: { kind: "resident_guest" },
      createdBy: null,
      guestCheckedAt: null,
      status: { in: ["booked", "reserved"] },
      endsAt: { gt: new Date() },
    },
    include: { facility: true, customer: true },
    orderBy: { startsAt: "asc" },
  });

  return (
    <>
      <PageTitle title="Guest checks" sub="Resident guests who booked online. Confirm each stay at reception before they play." />
      <TableCard>
        {waiting.length === 0 ? (
          <Empty>No guest checks waiting.</Empty>
        ) : (
          <Table
            heads={["When", "Facility", "Guest", "Room", "Phone", "Code", ""]}
            rows={waiting.map((b) => [
              `${b.startsAt.toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short" })}, ${lagosTime(b.startsAt)}`,
              b.facility.name,
              <b key="n">{b.customer.fullName}</b>,
              b.customer.roomNumber ?? "-",
              b.customer.phone ?? "-",
              <Link key="c" href={`/staff/bookings/${b.code}`} className="font-bold text-link hover:underline">
                {b.code}
              </Link>,
              <ActionForm key="a" action={updateBooking} submitLabel="Stay confirmed" variant="secondary" full={false} className="[&_button]:h-9 [&_button]:text-sm">
                <input type="hidden" name="code" value={b.code} />
                <input type="hidden" name="op" value="guest_ok" />
              </ActionForm>,
            ])}
          />
        )}
      </TableCard>
      <Notice>
        Until the hotel system (OPERA) is connected, online bookings from resident guests are not checked automatically. If someone is not
        a guest, open the booking and cancel it.
      </Notice>
    </>
  );
}
