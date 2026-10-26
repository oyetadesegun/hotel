/** Formats a naira amount, or says so plainly when a price has not been set yet. */
export function naira(amount: number | null | undefined): string {
  if (amount == null) return "Rate not set";
  return "₦" + String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const lagos = "Africa/Lagos";

/** "26 Oct 2026, 14:05" in Lagos time, or "Never". */
export function dateTime(d: Date | null | undefined): string {
  if (!d) return "Never";
  return d.toLocaleString("en-GB", { timeZone: lagos, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** "26 Oct 2026", or a dash. Dates without a time are stored at midnight UTC. */
export function dateOnly(d: Date | null | undefined): string {
  if (!d) return "-";
  return d.toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
}

/** Today's date in Lagos as YYYY-MM-DD, for date inputs. */
export function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: lagos });
}

/** The moment `n` days ago. */
export const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
