import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { BottomNav } from "@/src/components/BottomNav";
import { PillLink, WebPage } from "@/src/components/web";
import { bookingRules } from "@/src/lib/data";

export const metadata: Metadata = { title: "Terms and conditions" };

const sections = [
  { id: "booking", title: "Booking and payment", body: "Members and in-house resident guests are not charged. Walk-ins and visitors pay online. A reservation is held for a limited time and released if unpaid." },
  { id: "limits", title: "Limits", body: `Each person may book up to ${bookingRules.sessionsPer24h} sessions in any 24 hours. Bookings can be made up to ${bookingRules.customerBookAhead} ahead.` },
  { id: "cancellation", title: "Cancellation and refunds", body: "Free cancellation applies to bookings with no charge. A paid booking that is not used is not refunded." },
  { id: "priority", title: "Priority", body: "A paid booking cannot be overridden. The hotel may close a facility for maintenance or events and will contact you." },
  { id: "equipment", title: "Equipment rental", body: "Rentals are charged per item and per session. Items must be returned in good condition." },
  { id: "conduct", title: "Conduct and safety", body: "Guests play at their own risk and follow staff instructions and facility rules." },
  { id: "data", title: "Your data", body: "We use your details only to manage bookings and membership." },
];

export default function TermsPage() {
  return (
    <>
      <WebPage
        eyebrow="TERMS AND CONDITIONS"
        title="The"
        accent="small print."
        sub="Version 1.0, effective 1 Nov 2026. These apply to every booking and membership."
      >
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
          <nav aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-6 flex flex-col gap-1 rounded-2xl border border-line bg-white p-4">
              <span className="mb-1 px-2 text-[10px] font-extrabold tracking-[1.5px] text-charcoal-light">ON THIS PAGE</span>
              {sections.map((s, i) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="rounded-lg px-2 py-1.5 text-[13px] font-semibold text-charcoal hover:bg-surface hover:text-black"
                >
                  {i + 1}. {s.title}
                </a>
              ))}
            </div>
          </nav>

          <div className="flex flex-col gap-6">
            <ol className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-white px-5 md:px-8">
              {sections.map((s, i) => (
                <li key={s.id} id={s.id} className="flex scroll-mt-6 gap-4 py-5 md:gap-6 md:py-6">
                  <span className="w-8 shrink-0 font-display text-xl italic text-primary md:w-10 md:text-2xl">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h2 className="font-display text-lg font-normal md:text-xl">{s.title}</h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-charcoal">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="flex flex-col items-start gap-3 rounded-2xl bg-primary-subtle p-5 md:flex-row md:items-center md:justify-between md:p-6">
              <p className="text-sm leading-relaxed">
                <b>Questions about these terms?</b> Ask the Recreation desk before you book.
              </p>
              <PillLink href="/?book=1" className="shrink-0">
                Book a facility <ArrowRight size={16} aria-hidden="true" />
              </PillLink>
            </div>
          </div>
        </div>
      </WebPage>
      <BottomNav />
    </>
  );
}
