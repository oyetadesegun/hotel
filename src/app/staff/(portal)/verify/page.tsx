import type { Metadata } from "next";
import { prisma } from "@/src/lib/db";
import { requireStaff } from "@/src/lib/auth/session";
import { bookingStatusLabel, lagosDay, lagosTime } from "@/src/lib/bookings";
import { ActionForm } from "@/src/components/ActionForm";
import { updateBooking } from "@/src/app/staff/booking-actions";
import { Button, Card, Chip, KV, inputClass } from "@/src/components/ui";
import { PageTitle } from "@/src/components/staff";

export const metadata: Metadata = { title: "Verify a booking" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  await requireStaff();
  const { code = "" } = await searchParams;
  const c = code.trim().toUpperCase();
  const b = c ? await prisma.booking.findUnique({ where: { code: c }, include: { facility: true, customer: true } }) : null;

  const now = new Date();
  const problem = !b
    ? "No booking has this code."
    : b.status !== "booked"
      ? `This booking is ${bookingStatusLabel[b.status].toLowerCase()}.`
      : b.endsAt < now
        ? "This booking's time has already passed."
        : null;

  return (
    <>
      <PageTitle title="Verify a booking" />
      <Card className="max-w-3xl">
        <h2 className="text-lg font-bold">Check a booking at the desk</h2>
        <span className="text-[13px] text-charcoal">Type the booking code the customer shows you.</span>
        <form className="flex flex-wrap gap-2.5">
          <input name="code" defaultValue={c} aria-label="Booking code" placeholder="BK-…" required className={inputClass + " h-[46px] max-w-xs flex-1"} />
          <Button type="submit" size="md" className="h-[46px] text-sm">
            Check
          </Button>
        </form>
      </Card>
      {c && (
        <Card className={`max-w-3xl border-l-8 ${problem ? "border-danger" : "border-success"}`}>
          <div role={problem ? "alert" : undefined} className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[22px] font-bold">{problem ? "Not valid" : "Valid booking"}</h2>
            {b && <Chip tone={problem ? "bad" : "ok"}>{bookingStatusLabel[b.status]}</Chip>}
          </div>
          {problem && <p className="text-sm">{problem}</p>}
          {b && (
            <KV
              rows={[
                ["Facility", b.facility.name],
                ["Time", `${b.startsAt.toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short" })}, ${lagosTime(b.startsAt)} to ${lagosTime(b.endsAt)}`],
                ["Guest", b.customer.fullName],
              ]}
            />
          )}
          {b && !problem && b.customer.kind === "resident_guest" && !b.createdBy && !b.guestCheckedAt && (
            <p className="text-sm text-warn-fg">Resident guest booked online: check their room key before letting them in.</p>
          )}
          <div className="flex flex-wrap items-start gap-2.5">
            {b && !problem && lagosDay(b.startsAt) === lagosDay(now) && (
              <ActionForm action={updateBooking} submitLabel="Check in" full={false}>
                <input type="hidden" name="code" value={b.code} />
                <input type="hidden" name="op" value="check_in" />
                <input type="hidden" name="back" value={`/staff/bookings/${b.code}`} />
              </ActionForm>
            )}
            {b && (
              <Button href={`/staff/bookings/${b.code}`} variant="secondary" size="md">
                Open booking
              </Button>
            )}
          </div>
        </Card>
      )}
    </>
  );
}
