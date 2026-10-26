import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarCheck, IdCard } from "lucide-react";
import { BottomNav } from "@/src/components/BottomNav";
import { MembershipRates } from "@/src/components/MembershipRates";
import { PillLink, WebPage } from "@/src/components/web";
import { cacheLife, cacheTag } from "next/cache";
import { APPLICATION_FORM_FEE } from "@/src/lib/data";
import { currentRates } from "@/src/lib/membership";
import { naira } from "@/src/lib/format";

export const metadata: Metadata = { title: "Membership and rates" };

const perks = [
  { Icon: CalendarCheck, title: "Free court booking", body: "Book padel, tennis, squash and badminton with no charge." },
  { Icon: IdCard, title: "Pay first, details after", body: "Pay online in a minute, then complete your profile from the link we email you." },
  { Icon: BadgeCheck, title: "Your membership number", body: "Issued once the Recreation Manager approves you." },
];

/** Rate card from the database. Cached; call revalidateTag("rates") after rates change. */
async function getRates() {
  "use cache";
  cacheTag("rates");
  cacheLife("hours");
  return currentRates();
}

export default async function MembershipRatesPage() {
  const rates = await getRates();
  return (
    <>
      <WebPage
        eyebrow="MEMBERSHIP"
        title="Make recreation part of"
        accent="your routine."
        sub="Pick the category and length that suits you, pay online, then complete your profile from the link we email you."
      >
        <div className="flex flex-col gap-8 md:gap-12">
          <MembershipRates rates={rates} />

          <section className="grid overflow-hidden rounded-2xl bg-[#333437] text-white md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-5 p-6 md:p-9">
              <span className="text-[10px] font-extrabold tracking-[2px] text-white/60">WHAT YOU GET</span>
              <ul className="flex flex-col gap-4">
                {perks.map(({ Icon, title, body }) => (
                  <li key={title} className="flex gap-3.5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-primary-light">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span>
                      <b className="block font-display text-lg font-normal">{title}</b>
                      <span className="text-[13px] leading-relaxed text-white/70">{body}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col justify-center gap-4 bg-primary p-6 text-black md:p-9">
              <p className="font-display text-[28px] leading-tight md:text-[34px]">
                One place. <em>Every kind of play.</em>
              </p>
              <PillLink href="#rates" variant="light" className="self-start">
                Choose a plan <ArrowRight size={16} aria-hidden="true" />
              </PillLink>
              <Link href="/membership/me" className="text-[13px] font-bold underline-offset-2 hover:underline">
                Already a member? See my membership
              </Link>
              <p className="text-xs leading-relaxed text-black/70">
                First-time members who choose the printed form pay {naira(APPLICATION_FORM_FEE)} for it.
              </p>
            </div>
          </section>
        </div>
      </WebPage>
      <BottomNav />
    </>
  );
}
