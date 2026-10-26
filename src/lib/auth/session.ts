import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/db";
import { can, type Permission } from "@/src/lib/auth/roles";
import type { StaffRole } from "@/src/generated/prisma/client";

const COOKIE = "rec_session";
const STAFF_DAYS = 1; // staff sign in again every day
const MEMBER_DAYS = 30;

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Starts a session: a random token in an httpOnly cookie, only its hash in the database. */
export async function startSession(accountId: string, kind: "staff" | "member") {
  const token = randomBytes(32).toString("base64url");
  const days = kind === "staff" ? STAFF_DAYS : MEMBER_DAYS;
  const expiresAt = new Date(Date.now() + days * 86_400_000);
  await prisma.session.create({ data: { id: sha256(token), accountId, expiresAt } });
  await prisma.account.update({ where: { id: accountId }, data: { lastSignInAt: new Date() } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(COOKIE);
}

export type SignedIn = {
  accountId: string;
  email: string;
  kind: "staff" | "member";
  mustChangePassword: boolean;
  staff: { fullName: string; role: StaffRole } | null;
  customerId: string | null;
};

/** The signed-in account for this request, or null. Looked up once per request. */
export const getSignedIn = cache(async (): Promise<SignedIn | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: sha256(token) },
    include: { account: { include: { staff: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const a = session.account;
  if (a.kind === "staff" && (!a.staff || !a.staff.active)) return null;
  return {
    accountId: a.id,
    email: a.email,
    kind: a.kind,
    mustChangePassword: a.mustChangePassword,
    staff: a.staff ? { fullName: a.staff.fullName, role: a.staff.role } : null,
    customerId: a.customerId,
  };
});

export type StaffSignedIn = SignedIn & { staff: NonNullable<SignedIn["staff"]> };

/** For staff pages and actions: anyone else goes to the sign-in page. */
export async function requireStaff(): Promise<StaffSignedIn> {
  const me = await getSignedIn();
  if (!me || me.kind !== "staff" || !me.staff) redirect("/login");
  return me as StaffSignedIn;
}

/** For staff pages only some roles may open: anyone else goes back to the dashboard. */
export async function requireStaffCan(permission: Permission): Promise<StaffSignedIn> {
  const me = await requireStaff();
  if (!can(me.staff.role, permission)) redirect("/staff");
  return me;
}

/** For member pages and actions: anyone else goes to the sign-in page. */
export async function requireMember(): Promise<SignedIn & { customerId: string }> {
  const me = await getSignedIn();
  if (!me || me.kind !== "member" || !me.customerId) redirect("/login");
  return me as SignedIn & { customerId: string };
}
