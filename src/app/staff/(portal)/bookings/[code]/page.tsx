import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/src/lib/db";
import { requireStaff } from "@/src/lib/auth/session";
import { can } from "@/src/lib/auth/roles";
import { bookingStatusLabel, bookingStatusTone, lagosDay, lagosTime } from "@/src/lib/bookings";
import { walkInPriceKobo } from "@/src/lib/booking-engine";
import { dateTime, naira } from "@/src/lib/format";
import { toNaira } from "@/src/lib/membership";
import { ActionForm } from "@/src/components/ActionForm";
import { Button, Card, Chip, Field, KV, Notice, inputClass } from "@/src/components/ui";
import { Col, Cols, PageTitle } from "@/src/components/staff";
import { updateBooking } from "@/src/app/staff/booking-actions";

export const metadata: Metadata = { title: "Booking details" };

const kindLabel = { member: "Member", resident_guest: "Resident guest", walk_in: "Walk-in" } as const;
const methodLabel = { online: "online", pos: "card (POS)", cash: "cash", transfer: "transfer" } as const;

function Op({ code, op, label, variant = "secondary", children }: { code: string; op: string; label: string; variant?: "primary" | "secondary" | "danger"; children?: React.ReactNode }) {
  return (
    <ActionForm action={updateBooking} submitLabel={label} variant={variant}>
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="op" value={op} />
      {children}
    </ActionForm>
  );
}

export default async function StaffBookingDetailPage({ params, searchParams }: PageProps<"/staff/bookings/[code]">) {
  const [me, { code }, sp] = await Promise.all([requireStaff(), params, searchParams]);
  const b = await prisma.booking.findUnique({
    where: { code },
    include: { facility: true, customer: true, creator: true, checker: true, rentals: { include: { rentalItem: true } }, payments: true },
  });
  if (!b) notFound();

  const now = new Date();
  const paid = b.payments.filter((p) => p.status === "succeeded");
  const isToday = lagosDay(b.startsAt) === lagosDay(now);
  const live = b.status === "booked" || b.status === "reserved";
  const needsGuestCheck = b.customer.kind === "resident_guest" && !b.createdBy && !b.guestCheckedAt && live;
  const owed = b.status === "reserved" ? await walkInPriceKobo(b.id) : null;
  const canCancel = live && (paid.length === 0 || can(me.staff.role, "cancelPaidBooking"));
  const when = `${b.startsAt.toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", year: "numeric" })}, ${lagosTime(b.startsAt)} to ${lagosTime(b.endsAt)}`;

  return (
    <>
      <PageTitle title="Booking details">
        <Button href={`/staff/calendar?date=${lagosDay(b.startsAt)}`} variant="secondary" size="md" className="h-11 text-sm">
          Open in calendar
        </Button>
      </PageTitle>
      {sp.new && <Notice tone="ok">Booked. Give the customer the code {b.code}.</Notice>}
      <Cols>
        <Col grow={2} basis={520}>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-xs text-charcoal">Booking code</div>
                <h2 className="mt-0.5 text-[22px] font-bold tracking-wide">{b.code}</h2>
              </div>
              <Chip tone={bookingStatusTone[b.status]}>{bookingStatusLabel[b.status]}</Chip>
            </div>
            <KV
              rows={[
                ["Facility", b.facility.name],
                ["When", when],
                ["Equipment", b.rentals.map((r) => `${r.quantity} × ${r.rentalItem.name}`).join(", ") || "None"],
                ["Customer", `${b.customer.fullName} (${kindLabel[b.customer.kind]}${b.customer.roomNumber ? `, room ${b.customer.roomNumber}` : ""})`],
                ["Contact", [b.customer.phone, b.customer.email].filter(Boolean).join(", ") || "-"],
                ["Booked by", b.creator ? `${b.creator.fullName}, at the desk` : "Online"],
                ["Paid", paid.length ? paid.map((p) => `${naira(toNaira(p.amountKobo))} by ${methodLabel[p.method]}${p.receiptRef ? ` (${p.receiptRef})` : ""}`).join(", ") : b.customer.kind === "walk_in" ? "Not paid" : "No charge"],
                ...(b.customer.kind === "resident_guest"
                  ? [["Stay confirmed", b.createdBy ? "At the desk when booked" : b.guestCheckedAt ? `${dateTime(b.guestCheckedAt)} by ${b.checker?.fullName ?? "staff"}` : "Not yet"] as [string, string]]
                  : []),
              ]}
            />
          </Card>
        </Col>
        <Col basis={300}>
          {live && (
            <Card as="aside">
              <h3 className="text-base font-bold">Actions</h3>
              {needsGuestCheck && (
                <>
                  <Notice tone="warn">Booked online as a resident guest. Check the room key or hotel system, then confirm.</Notice>
                  <Op code={b.code} op="guest_ok" label="Confirm guest's stay" variant="primary" />
                </>
              )}
              {b.status === "reserved" && (
                <Op code={b.code} op="take_payment" label={`Take payment${owed != null ? `: ${naira(toNaira(owed))}` : ""}`} variant="primary">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="method" className="text-[13px] font-semibold">
                      Paid by
                    </label>
                    <select id="method" name="method" defaultValue="pos" className={inputClass}>
                      <option value="pos">Card (POS)</option>
                      <option value="cash">Cash</option>
                      <option value="transfer">Bank transfer</option>
                    </select>
                  </div>
                  <Field label="Receipt or reference (optional)" id="receiptRef" className="basis-auto" />
                  {b.holdExpiresAt && <p className="text-xs text-charcoal">The slot is released at {dateTime(b.holdExpiresAt)} if unpaid.</p>}
                </Op>
              )}
              {b.status === "booked" && isToday && <Op code={b.code} op="check_in" label="Check in" variant="primary" />}
              {b.status === "booked" && b.startsAt <= now && <Op code={b.code} op="no_show" label="Mark as no-show" />}
              {canCancel ? (
                <Op code={b.code} op="cancel" label="Cancel booking" variant="danger">
                  <Field label="Reason (optional)" id="reason" className="basis-auto" />
                  {paid.length > 0 && <p className="text-xs text-charcoal">This booking is paid. Cancelling frees the slot; any refund is handled separately.</p>}
                </Op>
              ) : (
                <Notice>This booking is paid. Only an admin can cancel it.</Notice>
              )}
            </Card>
          )}
          <Card as="aside">
            <h3 className="text-base font-bold">History</h3>
            <KV
              rows={[
                ["Created", dateTime(b.createdAt)],
                ...(b.holdExpiresAt && b.status === "reserved" ? [["Hold expires", dateTime(b.holdExpiresAt)] as [string, string]] : []),
                ...(b.termsVersion ? [["Terms accepted", b.termsVersion] as [string, string]] : []),
              ]}
            />
            {can(me.staff.role, "seeReports") && (
              <Button href={`/staff/audit?q=${b.code}`} variant="secondary" size="sm" className="self-start">
                See every change
              </Button>
            )}
          </Card>
        </Col>
      </Cols>
    </>
  );
}
