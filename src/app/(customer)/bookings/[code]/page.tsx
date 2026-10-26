import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/src/components/customer";
import { Chip, KV } from "@/src/components/ui";
import { prisma } from "@/src/lib/db";
import { requireMember } from "@/src/lib/auth/session";
import { bookingStatusLabel, bookingStatusTone, lagosTime } from "@/src/lib/bookings";
import { naira } from "@/src/lib/format";
import { toNaira } from "@/src/lib/membership";
import { ActionForm } from "@/src/components/ActionForm";
import { Notice } from "@/src/components/ui";
import { cancelMyBooking } from "@/src/app/book-actions";

export const metadata: Metadata = { title: "Booking details" };
export const instant = false;

export default async function BookingDetailPage({ params, searchParams }: PageProps<"/bookings/[code]">) {
  const [me, { code }, sp] = await Promise.all([requireMember(), params, searchParams]);
  const b = await prisma.booking.findUnique({
    where: { code },
    include: { facility: true, rentals: { include: { rentalItem: true } }, payments: { where: { status: "succeeded" } } },
  });
  // Members only see their own bookings.
  if (!b || b.customerId !== me.customerId) notFound();
  const canCancel =
    (b.status === "booked" || b.status === "reserved") && b.payments.length === 0 && b.startsAt.getTime() - new Date().getTime() >= 2 * 3_600_000;

  return (
    <>
      <PageHeader title="Booking details" back="/bookings" />
      <div className="flex flex-1 flex-col gap-3.5 bg-surface px-5 py-4">
        <section className="rounded-2xl bg-white p-4">
          <div className="mb-1.5 flex items-center justify-between">
            <b className="text-lg">{b.facility.name}</b>
            <Chip tone={bookingStatusTone[b.status]}>{bookingStatusLabel[b.status]}</Chip>
          </div>
          <KV
            rows={[
              [
                "When",
                `${b.startsAt.toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short" })}, ${lagosTime(b.startsAt)} to ${lagosTime(b.endsAt)}`,
              ],
              ["Rental", b.rentals.map((r) => `${r.quantity} × ${r.rentalItem.name}`).join(", ") || "None"],
              ["Paid", b.payments.length ? b.payments.map((p) => naira(toNaira(p.amountKobo))).join(", ") : "No charge"],
            ]}
          />
        </section>
        <section className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4">
          <b className="text-lg tracking-wide">{b.code}</b>
          <span className="text-xs text-charcoal">Show this code at the Recreation desk</span>
        </section>
        {sp.cancelled && <Notice tone="ok">Your booking is cancelled and the time is free for others.</Notice>}
        {canCancel && (
          <ActionForm action={cancelMyBooking} submitLabel="Cancel this booking" pendingLabel="Cancelling…" variant="secondary">
            <input type="hidden" name="code" value={b.code} />
          </ActionForm>
        )}
        {(b.status === "booked" || b.status === "reserved") && !canCancel && (
          <p className="text-xs leading-relaxed text-charcoal">To change or cancel this booking, contact the Recreation desk.</p>
        )}
        <p className="text-xs leading-relaxed text-charcoal">
          Free bookings can be cancelled here up to 2 hours before the start. Paid bookings that are not used are not refunded. Changes follow the terms and conditions.
        </p>
      </div>
    </>
  );
}
