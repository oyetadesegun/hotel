import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./ui";

/**
 * Layout for customer pages that should feel like the landing page on the web
 * and like an app screen on phones. The data-wide marker tells CustomerShell
 * to drop its white panel and use the full width.
 */
export function WebPage({
  eyebrow,
  title,
  accent,
  sub,
  children,
}: {
  eyebrow: string;
  title: string;
  /** Italic orange ending of the title, like "redefined." on the landing page. */
  accent?: string;
  sub?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div data-wide className="flex flex-1 flex-col">
      <header className="bg-white px-5 pb-5 pt-7 md:bg-transparent md:px-0 md:pb-9 md:pt-2">
        <span className="flex items-center gap-2.5 text-[10px] font-extrabold tracking-[2px] text-charcoal-light">
          <span className="h-px w-5 bg-charcoal-light/50" aria-hidden="true" />
          {eyebrow}
        </span>
        <h1 className="mt-3 font-display text-[38px] font-normal leading-[1.02] tracking-[-1.5px] md:text-[56px] md:tracking-[-2.5px]">
          {title} {accent && <em className="text-primary">{accent}</em>}
        </h1>
        {sub && <p className="mt-3 max-w-xl text-sm leading-relaxed text-charcoal md:text-[15px]">{sub}</p>}
      </header>
      <div className="flex flex-1 flex-col px-5 pb-6 pt-4 md:px-0 md:pb-0 md:pt-0">{children}</div>
    </div>
  );
}

/** Main column plus a side panel on laptops; stacked on phones. */
export function WithAside({ children, aside }: { children: ReactNode; aside: ReactNode }) {
  return (
    <div className="grid gap-5 md:gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-3">{children}</div>
      <aside className="flex flex-col gap-4">{aside}</aside>
    </div>
  );
}

export function AsideCard({
  title,
  children,
  dark,
  className,
}: {
  title?: string;
  children: ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-2xl p-5",
        dark ? "bg-[#333437] text-white" : "border border-line bg-white",
        className,
      )}
    >
      {title && <h2 className="font-display text-xl font-normal tracking-[-0.5px]">{title}</h2>}
      {children}
    </section>
  );
}

/** Orange pill button matching "Book a facility" on the landing page. */
export function PillLink({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "light" | "outline";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold transition-transform hover:-translate-y-0.5",
        variant === "primary" && "bg-primary text-black",
        variant === "light" && "bg-white text-black",
        variant === "outline" && "border-[1.5px] border-charcoal bg-white text-black",
        className,
      )}
    >
      {children}
    </Link>
  );
}
