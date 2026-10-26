import type { Metadata } from "next";
import { requireStaffCan } from "@/src/lib/auth/session";
import { bookableDays, getPublicSetup } from "@/src/lib/booking-engine";
import { PageTitle } from "@/src/components/staff";
import { DeskBooking } from "@/src/components/DeskBooking";

export const metadata: Metadata = { title: "New booking" };

export default async function StaffBookingPage({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const [, setup, { who }] = await Promise.all([requireStaffCan("bookAndVerify"), getPublicSetup(), searchParams]);
  const longest = Math.max(setup.staffBookAheadDays, ...setup.facilities.map((f) => f.bookAheadDays));
  const days = bookableDays(longest);
  return (
    <>
      <PageTitle title="Book for a customer" sub="For people who call or come to the desk: members, resident guests and walk-ins." />
      <DeskBooking
        setup={setup}
        today={days[0]}
        lastDay={days[days.length - 1]}
        initialWho={who === "walkin" || who === "resident" ? who : "member"}
      />
    </>
  );
}
