"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Clock3 } from "lucide-react";
import { Chip, cn, type Tone } from "./ui";

export type BookingItem = {
  facility: string;
  dow: string;
  day: number;
  month: string;
  time: string;
  extra?: string;
  status: string;
  tone: Tone;
  note?: string;
  code?: string;
  /** Reserved but not paid yet. */
  pay?: boolean;
  past?: boolean;
};

export function BookingsList({ items }: { items: BookingItem[] }) {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const shown = items.filter((b) => (tab === "past" ? b.past : !b.past));
  const counts = { upcoming: items.filter((b) => !b.past).length, past: items.filter((b) => b.past).length };

  return (
    <>
      <div role="tablist" aria-label="Bookings" className="mb-1 flex gap-2">
        {(["upcoming", "past"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "h-10 rounded-full px-4 text-sm font-semibold capitalize transition-colors",
              tab === t ? "bg-charcoal text-white" : "border-[1.5px] border-line bg-white hover:border-charcoal-light",
            )}
          >
            {t} <span className={tab === t ? "text-white/70" : "text-charcoal"}>· {counts[t]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <div className="rounded-2xl border border-dashed border-charcoal-light/50 bg-white p-8 text-center text-sm text-charcoal">
          Nothing here yet.
        </div>
      )}

      {shown.map((b) => (
        <article
          key={b.facility + b.day + b.time}
          className={cn(
            "flex gap-4 rounded-2xl border bg-white p-4 md:items-center md:gap-5 md:p-5",
            b.pay ? "border-warning shadow-[0_0_0_3px_#fef3c7]" : "border-line",
            b.past && "opacity-80",
          )}
        >
          <div
            className={cn(
              "flex w-14 shrink-0 flex-col items-center justify-center self-start rounded-xl py-2 md:w-16 md:self-center",
              b.past ? "bg-neutral-bg text-charcoal" : "bg-primary-subtle text-link",
            )}
          >
            <span className="text-[10px] font-extrabold tracking-[1.5px]">{b.dow.toUpperCase()}</span>
            <span className="font-display text-[26px] leading-none text-black">{b.day}</span>
            <span className="text-[10px] font-semibold">{b.month}</span>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl font-normal tracking-[-0.3px]">{b.facility}</h2>
              <Chip tone={b.tone}>{b.status}</Chip>
            </div>
            <div className="text-sm">
              {b.time}
              {b.extra && <span className="text-charcoal"> · {b.extra}</span>}
            </div>
            {b.note && (
              <div className={cn("flex items-center gap-1.5 text-[13px]", b.pay ? "font-semibold text-warn-fg" : "text-charcoal")}>
                {b.pay && <Clock3 size={14} aria-hidden="true" />}
                {b.note}
              </div>
            )}
            {b.code && (
              <div className="mt-1 flex items-center justify-between gap-3 border-t border-line pt-2.5 text-[13px] text-charcoal">
                <span>
                  Code <b className="tracking-wide text-black">{b.code}</b>
                </span>
                <Link href={`/bookings/${b.code}`} className="inline-flex items-center gap-1 font-bold text-link hover:underline">
                  Details <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        </article>
      ))}
    </>
  );
}
