"use client";

import { useState } from "react";
import { durations, type MembershipRate } from "@/src/lib/data";
import { naira } from "@/src/lib/format";
import { Lock } from "lucide-react";
import { Button, cn } from "./ui";
import { MembershipPayModal } from "./MembershipPayModal";

type DurationKey = (typeof durations)[number]["key"];

const blurbs: Record<string, string> = {
  Individual: "One adult",
  Couple: "Two adults",
  Family: "Two adults and their children",
  "Extra child": "Add a child to a family plan",
  Corporate: "Staff of a partner company",
};

/**
 * Rate cards with a duration switch, plus the Pay button for the chosen plan.
 * Prices come from the 2026 rate card in src/lib/data.ts.
 */
export function MembershipRates({ rates }: { rates: MembershipRate[] }) {
  const [duration, setDuration] = useState<DurationKey>("annual");
  const [selected, setSelected] = useState<string>(rates[0]?.category ?? "");
  const [paying, setPaying] = useState(false);
  const label = durations.find((d) => d.key === duration)!.label;
  const amount = rates.find((r) => r.category === selected)?.[duration] ?? null;
  const canPay = selected !== "Extra child" && amount != null;

  return (
    <section id="rates" aria-labelledby="rates-title" className="flex scroll-mt-24 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="rates-title" className="font-display text-2xl font-normal tracking-[-0.5px] md:text-3xl">
          2026 rates
        </h2>
        <div className="overflow-x-auto">
          <div role="radiogroup" aria-label="Membership length" className="flex w-max rounded-full border border-line bg-white p-1">
            {durations.map((d) => (
              <button
                key={d.key}
                type="button"
                role="radio"
                aria-checked={duration === d.key}
                onClick={() => setDuration(d.key)}
                className={cn(
                  "h-9 rounded-full px-3 text-[13px] font-semibold transition-colors md:px-4",
                  duration === d.key ? "bg-charcoal text-white" : "text-charcoal hover:text-black",
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div role="radiogroup" aria-label="Membership category" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {rates.map((r) => {
          const price = r[duration];
          const isSelected = selected === r.category;
          return (
            <button
              key={r.category}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelected(r.category)}
              className={cn(
                "flex flex-col gap-1.5 rounded-2xl border bg-white p-4 text-left transition-all md:p-5",
                isSelected
                  ? "border-primary shadow-[0_0_0_3px_var(--color-primary-subtle)]"
                  : "border-line hover:border-charcoal-light hover:shadow-sm",
                r.annual == null && "col-span-2 md:col-span-1",
              )}
            >
              <span className="text-[10px] font-extrabold tracking-[1.5px] text-charcoal-light">
                {r.category === "Individual" && !isSelected ? "MOST CHOSEN" : r.category.toUpperCase()}
              </span>
              <h3 className="font-display text-xl font-normal">{r.category}</h3>
              <p className="text-xs leading-snug text-charcoal">{blurbs[r.category]}</p>
              <div className="mt-auto pt-3">
                {price == null ? (
                  <span className="text-sm font-semibold">Agreed per company</span>
                ) : (
                  <>
                    <span className="block font-display text-[22px] leading-tight md:text-2xl">{naira(price)}</span>
                    <span className="text-xs text-charcoal">{duration === "annual" ? "per year" : `for ${label}`}</span>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
        <div>
          <span className="text-[10px] font-extrabold tracking-[1.5px] text-charcoal-light">YOUR CHOICE</span>
          <div className="font-display text-xl">
            {selected}, {label.toLowerCase()}
          </div>
          <div className="text-xs text-charcoal">
            {selected === "Extra child"
              ? "Added to an existing Family plan. Please ask the Recreation desk."
              : amount == null
                ? "Corporate rates are agreed with the Recreation desk."
                : "Pay now and complete your profile afterwards."}
          </div>
        </div>
        {canPay ? (
          <Button type="button" onClick={() => setPaying(true)} className="shrink-0">
            <Lock size={16} aria-hidden="true" /> Pay {naira(amount)}
          </Button>
        ) : (
          <Button type="button" disabled className="shrink-0">
            Ask the Recreation desk
          </Button>
        )}
      </div>
      <p className="text-xs text-charcoal">Effective 1 April 2026. Corporate rates are agreed with the Recreation desk.</p>

      {paying && canPay && amount != null && (
        <MembershipPayModal
          category={selected}
          duration={duration}
          durationLabel={label}
          amount={amount}
          onClose={() => setPaying(false)}
        />
      )}
    </section>
  );
}
