import Link from "next/link";
import { BrandHeader, CustomerShell } from "@/src/components/customer";
import { Button, cn } from "@/src/components/ui";
import { facilities } from "@/src/lib/data";

export default function HomePage() {
  return (
    <CustomerShell>
      <BrandHeader />
      <main className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-2.5">
        <h1 className="mt-2.5 text-[27px] font-bold leading-tight">Book a court in a few taps</h1>
        <p className="text-[15px] leading-normal text-charcoal">
          Pick a facility, choose a time and pay online. Members and resident guests are not charged.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {facilities.map((f, i) => (
            <Link
              key={f.id}
              href="/book"
              className={cn(
                "flex min-h-28 flex-col justify-end rounded-2xl p-4 hover:ring-2 hover:ring-primary-light",
                i % 3 === 0 ? "bg-primary-subtle" : "bg-surface",
              )}
            >
              <b className="text-[17px]">{f.name}</b>
              <span className="text-xs text-charcoal">Open {f.open} to midnight</span>
            </Link>
          ))}
        </div>
        <section className="flex flex-col gap-2.5 rounded-2xl border-[1.5px] border-line p-4">
          <b className="text-[15px]">Join the club</b>
          <span className="text-[13px] leading-relaxed text-charcoal">
            Apply online, pay, and start booking with a temporary card straight away.
          </span>
          <Button href="/membership" variant="secondary" size="md" full>
            See membership rates
          </Button>
        </section>
        <div className="flex-1" />
        <Button href="/book" full>
          Book now
        </Button>
        <Button href="/bookings" variant="ghost" full>
          View my bookings
        </Button>
      </main>
    </CustomerShell>
  );
}
