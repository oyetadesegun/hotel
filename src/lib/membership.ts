import "server-only";

import { randomBytes } from "node:crypto";
import { prisma } from "@/src/lib/db";
import { sha256 } from "@/src/lib/auth/session";
import type { ApplicationStatus, MembershipDuration } from "@/src/generated/prisma/client";

export const durationMonths: Record<MembershipDuration, number> = { m1: 1, m3: 3, m6: 6, annual: 12 };
export const durationLabel: Record<MembershipDuration, string> = {
  m1: "1 month",
  m3: "3 months",
  m6: "6 months",
  annual: "Annual",
};
export const isDuration = (v: string): v is MembershipDuration => v in durationMonths;

export const statusLabel: Record<ApplicationStatus, string> = {
  profile_pending: "Paid, profile not finished",
  paid_waiting_review: "Paid, waiting for review",
  approved: "Approved",
  rejected: "Rejected",
};

export const planText = (category: string, duration: MembershipDuration) =>
  `${category}, ${durationLabel[duration].toLowerCase()}`;

/** Kobo (BigInt in the database) to whole naira for display. */
export const toNaira = (kobo: bigint | null | undefined) => (kobo == null ? null : Number(kobo / BigInt(100)));

export type RateRow = { category: string; annual: number | null; m6: number | null; m3: number | null; m1: number | null };

const categoryOrder = ["Individual", "Couple", "Family", "Extra child", "Corporate"];

/** Current rate card from the database: the latest price per category and length that is in effect today. */
export async function currentRates(): Promise<RateRow[]> {
  const rows = await prisma.membershipRate.findMany({
    where: { effectiveFrom: { lte: new Date() } },
    orderBy: { effectiveFrom: "desc" },
  });
  const byCategory = new Map<string, RateRow>();
  const seen = new Set<string>();
  for (const r of rows) {
    // Rows are newest first, so the first one per category and length wins.
    if (seen.has(r.category + r.duration)) continue;
    seen.add(r.category + r.duration);
    const row = byCategory.get(r.category) ?? { category: r.category, annual: null, m6: null, m3: null, m1: null };
    row[r.duration] = toNaira(r.priceKobo);
    byCategory.set(r.category, row);
  }
  return [...byCategory.values()].sort(
    (a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category),
  );
}

/** Price in kobo for one plan today, or null when it is agreed per company / not set. */
export async function priceFor(category: string, duration: MembershipDuration): Promise<bigint | null> {
  const rate = await prisma.membershipRate.findFirst({
    where: { category, duration, effectiveFrom: { lte: new Date() } },
    orderBy: { effectiveFrom: "desc" },
  });
  return rate?.priceKobo ?? null;
}

/** Next application reference for this year, e.g. MA-2026-0007. */
export async function nextApplicationRef(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `MA-${year}-`;
  const last = await prisma.membership.findFirst({
    where: { applicationRef: { startsWith: prefix } },
    orderBy: { applicationRef: "desc" },
    select: { applicationRef: true },
  });
  const n = last ? Number(last.applicationRef.slice(prefix.length)) + 1 : 1;
  return prefix + String(n).padStart(4, "0");
}

/** One-time "complete your profile" link. Only the hash is stored. Valid for 14 days. */
export async function createProfileToken(accountId: string, membershipId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.accountToken.create({
    data: {
      id: sha256(token),
      accountId,
      membershipId,
      purpose: "complete_profile",
      expiresAt: new Date(Date.now() + 14 * 86_400_000),
    },
  });
  return token;
}

/** Looks up a profile link. Returns null when it is unknown, used or expired. */
export async function findProfileToken(token: string) {
  if (!token) return null;
  const row = await prisma.accountToken.findUnique({ where: { id: sha256(token) } });
  if (!row || row.purpose !== "complete_profile" || row.usedAt || row.expiresAt < new Date() || !row.membershipId) {
    return null;
  }
  const membership = await prisma.membership.findUnique({
    where: { id: row.membershipId },
    include: { customer: true },
  });
  if (!membership || membership.status !== "profile_pending") return null;
  return { token: row, membership };
}

/** Adds months to a date, e.g. start + 3 months; the day before is the last valid day. */
export function addMonths(d: Date, months: number) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

/** A member's most recent membership, with payments, for their own pages. */
export async function latestMembership(customerId: string) {
  return prisma.membership.findFirst({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: { customer: true, payments: { where: { status: "succeeded" } } },
  });
}
