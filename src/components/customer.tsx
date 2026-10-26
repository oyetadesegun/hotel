import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BackIcon, ClockIcon, CheckIcon, XIcon, cn } from "./ui";
import { SiteFooter, SiteHeader } from "./SiteHeader";

/** Phone-only brand bar. On laptops the SiteHeader shows the brand instead. */
export function BrandHeader() {
  return (
    <header className="flex items-center gap-2.5 px-5 pb-2 pt-5 md:hidden">
      <Image
        src="/Transcorp_Hotels_Logo.png"
        alt="Transcorp Hotels"
        width={120}
        height={34}
        style={{ height: "auto" }}
        priority
      />
      <div className="text-xs text-charcoal">Recreation</div>
    </header>
  );
}

/** Title bar with a back link. */
export function PageHeader({ title, back, sub }: { title: string; back: string; sub?: string }) {
  return (
    <header className="flex items-center gap-2 px-5 pb-1.5 pt-[18px]">
      <Link
        href={back}
        aria-label="Back"
        className="-ml-3 flex size-11 items-center justify-center text-charcoal"
      >
        <BackIcon />
      </Link>
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        {sub && <div className="text-xs text-charcoal">{sub}</div>}
      </div>
    </header>
  );
}

export function Body({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-1 flex-col gap-3.5 px-5 pb-5 pt-1", className)}>{children}</div>;
}

type Outcome = "ok" | "warn" | "bad" | "neutral";
const outcomeBg: Record<Outcome, string> = {
  ok: "bg-ok-bg text-ok-fg",
  warn: "bg-warn-bg text-warn-fg",
  bad: "bg-bad-bg text-bad-fg",
  neutral: "bg-neutral-bg text-charcoal",
};

/** Round status badge used on result screens (success, failed, expired, limit reached). */
export function OutcomeIcon({ tone, kind }: { tone: Outcome; kind: "check" | "x" | "clock" }) {
  return (
    <div className={cn("flex size-14 items-center justify-center rounded-full", outcomeBg[tone])}>
      {kind === "check" && <CheckIcon size={28} />}
      {kind === "x" && <XIcon size={28} />}
      {kind === "clock" && <ClockIcon size={28} />}
    </div>
  );
}

/** Placeholder QR block. Replace with a generated QR image of the booking code. */
export function QrPlaceholder({ size = 176 }: { size?: number }) {
  return (
    <div
      role="img"
      aria-label="QR code for entry check"
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-xl border-2 border-dashed border-charcoal-light text-center text-[13px] text-charcoal"
    >
      QR code
      <br />
      for entry check
    </div>
  );
}

/**
 * Customer page frame. Phones get a full-screen app layout; laptops get the website
 * header and footer from the landing page with the page content in a wide panel.
 */
export function CustomerShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col md:bg-surface md:pt-[78px]">
      <SiteHeader />
      <div className="flex flex-1 flex-col md:px-6 md:py-10">
        {/* Pages that render a WebPage (data-wide) use the full width with no white panel. */}
        <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col bg-white pb-[72px] has-[[data-wide]]:bg-surface md:flex-none md:max-w-3xl md:rounded-2xl md:px-6 md:py-6 md:pb-6 md:shadow-sm lg:max-w-4xl md:has-[[data-wide]]:max-w-6xl md:has-[[data-wide]]:rounded-none md:has-[[data-wide]]:p-0 md:has-[[data-wide]]:shadow-none">
          {children}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
