import "server-only";

import type { BookingStatus } from "@/src/generated/prisma/client";
import type { Tone } from "@/src/components/ui";

export const bookingStatusLabel: Record<BookingStatus, string> = {
  reserved: "Reserved, unpaid",
  booked: "Booked",
  used: "Used",
  cancelled: "Cancelled",
  expired: "Expired",
  no_show: "No-show",
};

export const bookingStatusTone: Record<BookingStatus, Tone> = {
  reserved: "warn",
  booked: "ok",
  used: "neutral",
  cancelled: "neutral",
  expired: "neutral",
  no_show: "bad",
};

/** "YYYY-MM-DD" for a date in Lagos. */
export const lagosDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

/** Start of a Lagos day (UTC+1, no daylight saving). */
export const dayStart = (iso: string) => new Date(`${iso}T00:00:00+01:00`);

export const lagosTime = (d: Date) =>
  d.toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" });

export const lagosHour = (d: Date) => Number(d.toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", hour12: false }));
