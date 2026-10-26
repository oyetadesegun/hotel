"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";
import { UserMenu } from "./UserMenu";

const links = [
  { href: "/bookings", label: "My bookings" },
  { href: "/messages", label: "Messages" },
  { href: "/membership", label: "Membership" },
  { href: "/terms", label: "Terms" },
];

/** Brand mark shared by the landing page look: Transcorp Hotels logo | RECREATION. */
export function BrandMark({ small }: { small?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3.5" aria-label="Transcorp Hotels Recreation home">
      <Image
        src="/Transcorp_Hotels_Logo.png"
        alt="Transcorp Hotels"
        width={small ? 140 : 190}
        height={small ? 40 : 54}
        style={{ height: "auto" }}
        priority
      />
      <span className="h-6 w-px bg-[#d7d7d7]" aria-hidden="true" />
      <span className="text-[10px] font-extrabold tracking-[2px] text-[#f58220]">RECREATION</span>
    </Link>
  );
}

/** Website header for customer pages on laptop and desktop screens. Hidden on phones. */
export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="hidden h-[78px] items-center justify-between border-b border-[#eeeeee] bg-white px-[5.5vw] md:fixed md:top-0 md:left-0 md:right-0 md:z-50 md:flex">
      <BrandMark />
      <nav aria-label="Main" className="flex gap-8 text-[13px] font-semibold text-[#58635c]">
        {links.map((l) => {
          const active = pathname === l.href || pathname.startsWith(l.href + "/");
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn("hover:text-[#f58220]", active && "text-[#f58220]")}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-5">
      <UserMenu />
      <Link
        href="/?book=1"
        className="inline-flex items-center gap-2.5 rounded-full bg-[#f58220] px-4 py-3 text-[13px] font-bold text-white transition-transform hover:-translate-y-0.5"
      >
        Book a facility <span aria-hidden="true">→</span>
      </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="hidden items-center gap-8 px-[5.5vw] py-7 text-[11px] text-[#7b867e] md:flex">
      <div className="mr-auto">
        <BrandMark small />
      </div>
      <span>© 2026 Transcorp Hotels Plc</span>
      <Link href="/messages" className="hover:text-[#f58220]">Help centre</Link>
      <Link href="/terms" className="hover:text-[#f58220]">Terms</Link>
    </footer>
  );
}
