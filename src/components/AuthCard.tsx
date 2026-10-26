import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, IdCard, ShieldCheck } from "lucide-react";

const photo = "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=2000&q=80";

const points = [
  { Icon: IdCard, text: "Members: your card, profile and application progress" },
  { Icon: CalendarDays, text: "Book courts and see your bookings" },
  { Icon: ShieldCheck, text: "Staff: applications, bookings and the desk" },
];

/** Full-screen photo backdrop with a sign-in style card. Used by sign-in, first-run setup and password pages. */
export function AuthCard({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-dvh overflow-hidden bg-[#141210] text-white">
      <div aria-hidden="true" className="absolute inset-0 -z-20 scale-105 bg-cover bg-center" style={{ backgroundImage: `url(${photo})` }} />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(115deg,rgba(12,11,10,0.94)_0%,rgba(12,11,10,0.72)_48%,rgba(230,110,0,0.5)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute -right-40 -top-40 -z-10 size-[520px] rounded-full border-[56px] border-primary/25 max-lg:hidden"
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col justify-center gap-8 px-4 py-8 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
        <section className="flex flex-col gap-5 lg:max-w-md">
          <Link href="/" className="self-start text-[11px] font-extrabold tracking-[3px] text-primary-light hover:text-white">
            TRANSCORP HILTON ABUJA · RECREATION
          </Link>
          <h2 className="font-display text-4xl leading-[1.05] sm:text-6xl max-lg:hidden">
            Make room
            <br />
            <em className="text-primary-light">for play.</em>
          </h2>
          <p className="text-[15px] leading-relaxed text-white/80 max-lg:hidden">
            Tennis, padel, squash and badminton at the Hiltonia Club. One sign-in for members and staff.
          </p>
          <ul className="flex flex-col gap-3 max-lg:hidden">
            {points.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/90">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
                  <Icon size={17} aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </section>

        <main className="flex w-full max-w-[440px] flex-col gap-4 self-center rounded-3xl bg-white p-7 text-black shadow-2xl sm:p-9 [&>*]:shrink-0">
          <Image src="/Transcorp_Hotels_Logo.png" alt="Transcorp Hotels" width={160} height={45} style={{ height: "auto" }} priority />
          <div>
            <h1 className="mt-2 text-[26px] font-bold leading-tight">{title}</h1>
            {sub && <p className="mt-1.5 text-sm leading-relaxed text-charcoal">{sub}</p>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
