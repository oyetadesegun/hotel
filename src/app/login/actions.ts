"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/db";
import { audit } from "@/src/lib/audit";
import { verifyPassword } from "@/src/lib/auth/password";
import { endSession, startSession } from "@/src/lib/auth/session";

export type SignInState = { error?: string } | undefined;

/** Only send members back to their own pages after signing in, never to another site. */
const memberNext = (path: string) =>
  /^\/(membership|bookings|messages)(\/|\?|$)/.test(path) || path === "/?book=1" ? path : "/membership/me";

/** One sign-in for everyone: staff go to the staff portal, members to their membership. */
export async function signIn(_: SignInState, fd: FormData): Promise<SignInState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const account = await prisma.account.findUnique({ where: { email }, include: { staff: true } });
  const wrong = { error: "That email and password do not match an account." };
  if (!account) return wrong;
  if (account.kind === "member" && !account.passwordHash) {
    return { error: "You have not set a password yet. Use the link in the email we sent after your payment." };
  }
  if (!(await verifyPassword(password, account.passwordHash))) return wrong;

  if (account.kind === "staff") {
    if (!account.staff?.active) return { error: "This staff account is disabled. Please ask an admin." };
    await startSession(account.id, "staff");
    await audit(account.id, "Signed in", email);
    redirect(account.mustChangePassword ? "/staff/password" : "/staff");
  }

  await startSession(account.id, "member");
  redirect(memberNext(String(fd.get("next") ?? "")));
}

export async function signOut() {
  await endSession();
  redirect("/login");
}
