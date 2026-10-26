import type { ReactNode } from "react";
import { Button, Card, Chip, SampleTag, cn, type Tone } from "./ui";

export function PageTitle({
  title,
  sub,
  sample = false,
  children,
}: {
  title: string;
  sub?: string;
  sample?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[26px] font-bold">{title}</h1>
          {sample && <SampleTag />}
        </div>
        {sub && <p className="mt-1 max-w-3xl text-sm text-charcoal">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </div>
  );
}

export function Cols({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-start gap-4", className)}>{children}</div>;
}

/** A column that takes a share of the row and wraps on narrow screens. */
export function Col({ grow = 1, basis = 300, children }: { grow?: number; basis?: number; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-4" style={{ flex: `${grow} 1 ${basis}px` }}>
      {children}
    </div>
  );
}

export function TableCard({ children, className }: { children: ReactNode; className?: string }) {
  return <Card className={cn("overflow-x-auto p-4", className)}>{children}</Card>;
}

export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button href={href} variant="secondary" size="sm">
      {children}
    </Button>
  );
}

export function EditLink({ href = "#" }: { href?: string }) {
  return (
    <a href={href} className="font-bold text-link hover:underline">
      Edit
    </a>
  );
}

export function KpiCard({ label, value, note, noteTone }: { label: string; value: string; note: string; noteTone?: string }) {
  return (
    <div className="rounded-2xl bg-white p-[18px]">
      <div className="text-[13px] text-charcoal">{label}</div>
      <div className="my-1.5 text-[34px] font-bold leading-tight">{value}</div>
      <div className={cn("text-xs", noteTone ?? "text-charcoal")}>{note}</div>
    </div>
  );
}

export function StatusChip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <Chip tone={tone}>{children}</Chip>;
}

/** Shown where a list has nothing in it yet. */
export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-surface px-4 py-6 text-center text-sm text-charcoal">{children}</div>;
}
