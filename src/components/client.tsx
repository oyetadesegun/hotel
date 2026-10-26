"use client";

import { useState } from "react";
import { cn } from "./ui";

/** Filter pills. Purely visual until a list is wired to real data. */
export function FilterTabs({
  items,
  defaultIndex = 0,
  className,
}: {
  items: string[];
  defaultIndex?: number;
  className?: string;
}) {
  const [active, setActive] = useState(defaultIndex);
  return (
    <div role="tablist" className={cn("flex flex-wrap gap-2 text-sm font-semibold", className)}>
      {items.map((t, i) => (
        <button
          key={t}
          role="tab"
          aria-selected={i === active}
          type="button"
          onClick={() => setActive(i)}
          className={cn(
            "h-10 rounded-full px-4",
            i === active ? "bg-charcoal text-white" : "bg-white hover:bg-neutral-bg",
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, defaultOn = true }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => setOn(!on)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        on ? "bg-success" : "bg-charcoal-light",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] size-[18px] rounded-full bg-white transition-all",
          on ? "left-[23px]" : "left-[3px]",
        )}
      />
    </button>
  );
}
