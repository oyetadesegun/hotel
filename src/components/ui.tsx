import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ---------- Status chips ---------- */

export type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "accent";

const toneClass: Record<Tone, string> = {
  ok: "bg-ok-bg text-ok-fg",
  warn: "bg-warn-bg text-warn-fg",
  bad: "bg-bad-bg text-bad-fg",
  info: "bg-info-bg text-info-fg",
  neutral: "bg-neutral-bg text-neutral-fg",
  accent: "bg-primary-subtle text-link",
};

export function Chip({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SampleTag() {
  return (
    <span className="rounded-full bg-neutral-bg px-3 py-1 text-xs font-semibold text-neutral-fg">
      Sample data
    </span>
  );
}

/* ---------- Buttons ---------- */

const variants = {
  primary: "bg-primary text-black hover:bg-primary-dark",
  secondary: "border-[1.5px] border-charcoal bg-white font-semibold hover:bg-surface",
  danger: "bg-danger text-black hover:brightness-95",
  ghost: "font-semibold text-link hover:underline",
} as const;

const sizes = {
  sm: "h-9 rounded-lg px-3.5 text-sm",
  md: "h-12 rounded-xl px-6 text-[15px]",
  lg: "h-[52px] rounded-xl px-6 text-base",
} as const;

type ButtonProps = {
  href?: string;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  full?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<"button">, "className" | "children">;

export function Button({
  href,
  variant = "primary",
  size = "lg",
  full,
  className,
  children,
  ...rest
}: ButtonProps) {
  const cls = cn(
    "inline-flex items-center justify-center gap-2 font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-dark disabled:cursor-not-allowed disabled:opacity-40",
    variants[variant],
    variant === "ghost" ? "h-10 px-2 text-sm" : sizes[size],
    full && "w-full",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

/* ---------- Form controls ---------- */

export const inputClass =
  "h-12 w-full rounded-[10px] border-[1.5px] border-charcoal-light bg-white px-3 text-base outline-none focus:border-primary-dark focus:ring-2 focus:ring-primary/40 disabled:bg-surface";

export function Field({
  label,
  id,
  className,
  hint,
  ...input
}: { label: string; id: string; hint?: string; className?: string } & ComponentProps<"input">) {
  return (
    <div className={cn("flex min-w-0 flex-1 basis-48 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-semibold">
        {label}
      </label>
      <input id={id} name={id} className={inputClass} {...input} />
      {hint && <span className="text-xs text-charcoal">{hint}</span>}
    </div>
  );
}

export function SelectField({
  label,
  id,
  options,
  className,
  ...select
}: {
  label: string;
  id: string;
  options: string[];
  className?: string;
} & ComponentProps<"select">) {
  return (
    <div className={cn("flex min-w-0 flex-1 basis-48 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-semibold">
        {label}
      </label>
      <select id={id} name={id} className={inputClass} {...select}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

/** Radio or checkbox shown as a bordered card. The selected style needs no JavaScript. */
export function OptionCard({
  type = "radio",
  name,
  children,
  className,
  ...input
}: {
  type?: "radio" | "checkbox";
  name: string;
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<"input">, "type" | "name" | "children" | "className">) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-[10px] border-[1.5px] border-line bg-white px-3 py-3 text-sm font-semibold has-checked:border-primary has-checked:bg-primary-subtle has-focus-visible:outline-2 has-focus-visible:outline-primary-dark",
        className,
      )}
    >
      <input type={type} name={name} className="size-[18px] shrink-0 accent-primary" {...input} />
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

export function CheckRow({
  children,
  price,
  ...input
}: { children: ReactNode; price?: string } & Omit<ComponentProps<"input">, "type" | "children">) {
  return (
    <label className="flex items-center gap-2.5 text-sm">
      <input type="checkbox" className="size-5 accent-primary" {...input} />
      <span className="flex-1">{children}</span>
      {price && <b>{price}</b>}
    </label>
  );
}

/* ---------- Layout pieces ---------- */

export function Card({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "aside" | "div";
}) {
  return (
    <Tag className={cn("flex min-w-0 flex-col gap-3.5 rounded-2xl bg-white p-5", className)}>
      {children}
    </Tag>
  );
}

export function KV({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <div className="flex flex-col">
      {rows.map(([k, v]) => (
        <div
          key={k}
          className="flex justify-between gap-3 border-t border-neutral-bg py-2.5 text-sm first:border-t-0"
        >
          <span className="text-charcoal">{k}</span>
          <b className="text-right">{v}</b>
        </div>
      ))}
    </div>
  );
}

export function Notice({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "bad" ? "alert" : undefined}
      className={cn("rounded-xl px-3.5 py-3 text-[13px] leading-relaxed", toneClass[tone], className)}
    >
      {children}
    </div>
  );
}

export function Divider() {
  return <div className="h-px bg-line" />;
}

/* ---------- Icons ---------- */

type IconProps = { className?: string; size?: number };
const svgProps = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className,
});

export const BackIcon = ({ size = 22, className }: IconProps) => (
  <svg {...svgProps(size, className)}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);
export const CheckIcon = ({ size = 22, className }: IconProps) => (
  <svg {...svgProps(size, className)} strokeWidth={2.5}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
export const XIcon = ({ size = 22, className }: IconProps) => (
  <svg {...svgProps(size, className)} strokeWidth={2.5}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
export const ClockIcon = ({ size = 22, className }: IconProps) => (
  <svg {...svgProps(size, className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const LockIcon = ({ size = 18, className }: IconProps) => (
  <svg {...svgProps(size, className)}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
export const CalendarIcon = ({ size = 22, className }: IconProps) => (
  <svg {...svgProps(size, className)}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 11h18" />
  </svg>
);
export const ListIcon = ({ size = 22, className }: IconProps) => (
  <svg {...svgProps(size, className)}>
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);
export const BellIcon = ({ size = 22, className }: IconProps) => (
  <svg {...svgProps(size, className)}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
export const CardIcon = ({ size = 22, className }: IconProps) => (
  <svg {...svgProps(size, className)}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
  </svg>
);
