/** Helpers shared by the facility setup pages and their server actions. */

export const sessionLengths = [30, 60, 90, 120] as const;

/** Opening and closing times on a half-hour grid, 00:00 to 24:00. */
export const halfHours = Array.from({ length: 49 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  return `${h}:${i % 2 ? "30" : "00"}`;
});

export const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** A `time` column as HH:MM. Midnight as a closing time reads back as 00:00, so it is shown as 24:00. */
export function timeOf(d: Date, closing = false): string {
  const t = d.toISOString().slice(11, 16);
  return closing && t === "00:00" ? "24:00" : t;
}

/** "Padel Court 2" -> "padel-court-2" */
export const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "facility";

/**
 * Reads a naira amount typed by staff ("15,000" or "15000.50") as kobo.
 * Returns null for an empty box and undefined when it is not a valid amount.
 */
export function koboFromInput(raw: string): bigint | null | undefined {
  const v = raw.replace(/[,\s₦]/g, "");
  if (v === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return undefined;
  return BigInt(Math.round(Number(v) * 100));
}

/** Kobo as a plain naira number for an input box, e.g. 1500000 -> "15000". */
export const nairaInput = (kobo: bigint | null | undefined) => (kobo == null ? "" : String(Number(kobo) / 100));

/** The rules an admin can change, with their limits. Fees are typed in naira and stored in kobo. */
export const ruleFields = [
  { key: "sessions_per_24h", label: "Sessions per person, per facility, in 24 hours", min: 1, max: 24 },
  { key: "hold_unpaid_hours", label: "Hours an unpaid reservation is held", min: 1, max: 72 },
  { key: "staff_book_ahead_days", label: "Days ahead staff can book", min: 0, max: 365 },
] as const;

export const rateCategories = ["Individual", "Couple", "Family", "Extra child", "Corporate"];
