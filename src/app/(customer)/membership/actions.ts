"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/db";
import { audit } from "@/src/lib/audit";
import { appUrl, sendEmail } from "@/src/lib/mail";
import { hashPassword, passwordProblem, verifyPassword } from "@/src/lib/auth/password";
import { getSignedIn, startSession } from "@/src/lib/auth/session";
import { findProfileToken, isDuration, latestMembership, nextApplicationRef, planText, priceFor } from "@/src/lib/membership";
import { readProfile } from "@/src/lib/profile";
import { photoProblem, savePhoto } from "@/src/lib/storage";
import type { Membership } from "@/src/generated/prisma/client";

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** Online payment is in test mode until RedPay is connected (PAYMENT_MODE=test in .env.local). */
export const paymentMode = async () => (process.env.PAYMENT_MODE === "test" ? "test" : "off");

export type PayResult = { error: string } | { ok: true; applicationRef: string; email: string };

/**
 * Pay for a membership. In test mode the payment is recorded as a successful TEST payment straight away.
 * With RedPay this splits in two: this action records an "initiated" payment and opens RedPay,
 * and RedPay's webhook marks it succeeded and runs the "after payment" part below.
 *
 * The member chooses their password here, so they can sign in afterwards and finish their profile.
 */
export async function payForMembership(input: {
  category: string;
  duration: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
  acceptTerms: boolean;
}): Promise<PayResult> {
  if ((await paymentMode()) !== "test") return { error: "Online payment is not connected yet. Please pay at the Recreation desk." };

  const fullName = input.fullName.trim().slice(0, 120);
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim().slice(0, 40);
  if (!fullName || !phone) return { error: "Please enter your name and phone number." };
  if (!isEmail(email)) return { error: "Please enter a valid email." };
  if (!input.acceptTerms) return { error: "Please accept the terms and conditions." };
  const duration = input.duration;
  if (!isDuration(duration)) return { error: "Please choose a membership length." };
  if (input.category === "Extra child" || input.category === "Corporate") {
    return { error: "Please ask the Recreation desk for this membership." };
  }
  // The price always comes from the database, never from the browser.
  const amountKobo = await priceFor(input.category, duration);
  if (amountKobo == null) return { error: "This membership has no price set. Please ask the Recreation desk." };

  const existing = await prisma.account.findUnique({
    where: { email },
    include: { customer: { include: { memberships: true } } },
  });
  if (existing?.kind === "staff") return { error: "This email belongs to a staff account. Please use a personal email." };
  if (existing?.passwordHash) {
    // A returning member: they must prove it is their account.
    if (!(await verifyPassword(input.password, existing.passwordHash))) {
      return { error: "This email already has an account. Enter the password you use for it, or sign in first." };
    }
  } else {
    const problem = passwordProblem(input.password);
    if (problem) return { error: `Password: ${problem}` };
    if (input.password !== input.confirm) return { error: "The two passwords do not match." };
  }
  const today = new Date();
  const live = existing?.customer?.memberships.find(
    (m) =>
      m.status === "profile_pending" ||
      m.status === "paid_waiting_review" ||
      (m.status === "approved" && (!m.endsOn || m.endsOn >= today)),
  );
  if (live) return { error: "You already have a membership with this email. Please sign in to see it." };

  const passwordHash = existing?.passwordHash ?? (await hashPassword(input.password));
  const applicationRef = await nextApplicationRef();
  const { membership, accountId } = await prisma.$transaction(async (tx) => {
    const customer = existing?.customer
      ? await tx.customer.update({ where: { id: existing.customer.id }, data: { fullName, phone, email } })
      : await tx.customer.create({ data: { kind: "member", fullName, phone, email } });
    const account = existing
      ? await tx.account.update({ where: { id: existing.id }, data: { passwordHash, customerId: customer.id } })
      : await tx.account.create({ data: { email, kind: "member", customerId: customer.id, passwordHash } });
    const membership = await tx.membership.create({
      data: {
        applicationRef,
        customerId: customer.id,
        category: input.category,
        duration,
        status: "profile_pending",
      },
    });
    await tx.payment.create({
      data: {
        membershipId: membership.id,
        method: "online",
        status: "succeeded",
        amountKobo,
        gatewayRef: `TEST-${randomBytes(6).toString("hex").toUpperCase()}`,
      },
    });
    return { membership, accountId: account.id };
  });

  // After payment: sign them in and email how to finish the profile.
  await startSession(accountId, "member");
  await audit(`member:${membership.customerId}`, "Membership paid", applicationRef, {
    plan: planText(membership.category, membership.duration),
    amountKobo: amountKobo.toString(),
    mode: "test",
  });
  await sendEmail({
    to: email,
    subject: "Payment received: complete your Hiltonia Club membership profile",
    text: `Hello ${fullName},\n\nWe have received your payment for ${planText(membership.category, membership.duration)} (application ${applicationRef}).\n\nYour membership is pending until you complete your profile. Sign in with this email and the password you chose:\n${appUrl("/login?next=/membership/profile")}\n\nOnce your profile is in, you get a temporary card while the Recreation team checks it.`,
  });

  return { ok: true, applicationRef, email };
}

export type ProfileState = { error?: string } | undefined;

/**
 * Saves the membership profile. Works from the emailed link (with a token) or for a signed-in member.
 * The first save moves the membership to "waiting for review" and gives a temporary card;
 * later saves update the details until staff approve or reject the application.
 */
export async function submitProfile(_: ProfileState, fd: FormData): Promise<ProfileState> {
  const tokenValue = String(fd.get("token") ?? "");
  let accountId: string;
  let tokenId: string | null = null;
  let membership: Pick<Membership, "id" | "customerId" | "applicationRef" | "status" | "category" | "duration" | "photoPath" | "profileCompletedAt">;
  if (tokenValue) {
    const found = await findProfileToken(tokenValue);
    if (!found) return { error: "This link has expired or was already used. Sign in to finish your profile." };
    accountId = found.token.accountId;
    tokenId = found.token.id;
    membership = found.membership;
  } else {
    const me = await getSignedIn();
    if (!me || me.kind !== "member" || !me.customerId) return { error: "Please sign in again." };
    const latest = await latestMembership(me.customerId);
    if (!latest || (latest.status !== "profile_pending" && latest.status !== "paid_waiting_review")) {
      return { error: "Your profile can no longer be changed online. Please ask the Recreation desk." };
    }
    accountId = me.accountId;
    membership = latest;
  }
  const firstTime = membership.status === "profile_pending";

  const read = readProfile(fd);
  if ("error" in read) return { error: read.error };
  const photo = fd.get("photo");
  const newPhoto = photo instanceof File && photo.size > 0 ? photo : null;
  if (newPhoto || !membership.photoPath) {
    const photoError = photoProblem(newPhoto);
    if (photoError) return { error: photoError };
  }
  const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
  let passwordHash: string | undefined;
  if (!account.passwordHash) {
    const password = String(fd.get("password") ?? "");
    const problem = passwordProblem(password);
    if (problem) return { error: `Password: ${problem}` };
    if (password !== String(fd.get("confirm") ?? "")) return { error: "The two passwords do not match." };
    passwordHash = await hashPassword(password);
  }
  const fullName = String(fd.get("fullName") ?? "").trim().slice(0, 120);
  const phone = String(fd.get("phone") ?? "").trim().slice(0, 40);
  if (!fullName || !phone) return { error: "Please fill in your name and phone." };

  const photoPath = newPhoto ? await savePhoto(membership.id, newPhoto) : undefined;
  await prisma.$transaction([
    prisma.membership.update({
      where: { id: membership.id },
      data: {
        profile: read.profile,
        profileCompletedAt: membership.profileCompletedAt ?? new Date(),
        ...(photoPath ? { photoPath } : {}),
        status: "paid_waiting_review",
      },
    }),
    prisma.customer.update({ where: { id: membership.customerId }, data: { fullName, phone } }),
    ...(passwordHash ? [prisma.account.update({ where: { id: accountId }, data: { passwordHash } })] : []),
    ...(tokenId ? [prisma.accountToken.update({ where: { id: tokenId }, data: { usedAt: new Date() } })] : []),
  ]);
  await audit(`member:${membership.customerId}`, firstTime ? "Profile completed" : "Profile updated", membership.applicationRef);

  if (firstTime) {
    // Tell staff there is an application to review.
    const staff = await prisma.staffUser.findMany({ where: { active: true }, include: { account: true } });
    for (const s of staff) {
      await sendEmail({
        to: s.account.email,
        subject: `New membership application to review: ${membership.applicationRef}`,
        text: `${fullName} has paid for ${planText(membership.category, membership.duration)} and completed their profile.\nReview it at ${appUrl(`/staff/applications?id=${membership.id}`)}`,
      });
    }
  }

  if (tokenId) await startSession(accountId, "member");
  redirect(firstTime ? "/membership/card" : "/membership/me?updated=1");
}
