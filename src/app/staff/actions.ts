"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/db";
import { audit } from "@/src/lib/audit";
import { appUrl, sendEmail } from "@/src/lib/mail";
import { hashPassword, passwordProblem, temporaryPassword, verifyPassword } from "@/src/lib/auth/password";
import { can, roleLabel, type Permission } from "@/src/lib/auth/roles";
import { requireStaff, startSession } from "@/src/lib/auth/session";
import { addMonths, createProfileToken, durationMonths, isDuration, nextApplicationRef, planText, priceFor } from "@/src/lib/membership";
import { StaffRole } from "@/src/generated/prisma/client";

export type FormState = { error?: string; ok?: string; tempPassword?: string } | undefined;

const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const emailOf = (fd: FormData) => field(fd, "email").toLowerCase();
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

async function requirePermission(permission: Permission) {
  const me = await requireStaff();
  if (!can(me.staff.role, permission)) throw new Error("You do not have permission to do this.");
  return me;
}

// ---------- First run ----------

/** Creates the very first staff account (an admin). Only works while there are no staff at all. */
export async function setupFirstAdmin(_: FormState, fd: FormData): Promise<FormState> {
  if ((await prisma.staffUser.count()) > 0) return { error: "Setup is already done. Please sign in." };
  const fullName = field(fd, "fullName");
  const email = emailOf(fd);
  const password = field(fd, "password");
  if (!fullName) return { error: "Please enter your name." };
  if (!isEmail(email)) return { error: "Please enter a valid email." };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== field(fd, "confirm")) return { error: "The two passwords do not match." };

  const account = await prisma.account.create({
    data: {
      email,
      kind: "staff",
      passwordHash: await hashPassword(password),
      staff: { create: { fullName, role: "admin" } },
    },
  });
  await audit(account.id, "First admin created", email, { role: "admin" });
  await startSession(account.id, "staff");
  redirect("/staff");
}

// ---------- Own password ----------

export async function changeOwnPassword(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireStaff();
  const account = await prisma.account.findUniqueOrThrow({ where: { id: me.accountId } });
  if (!(await verifyPassword(field(fd, "current"), account.passwordHash))) return { error: "Your current password is not right." };
  const password = field(fd, "password");
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== field(fd, "confirm")) return { error: "The two new passwords do not match." };
  if (password === field(fd, "current")) return { error: "Choose a password different from the current one." };

  await prisma.account.update({
    where: { id: me.accountId },
    data: { passwordHash: await hashPassword(password), mustChangePassword: false },
  });
  await audit(me.accountId, "Password changed", me.email);
  redirect("/staff");
}

// ---------- Staff users ----------

export async function createStaffUser(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requirePermission("manageUsers");
  const fullName = field(fd, "fullName");
  const email = emailOf(fd);
  const role = field(fd, "role") as StaffRole;
  if (!fullName) return { error: "Please enter their name." };
  if (!isEmail(email)) return { error: "Please enter a valid work email." };
  if (!Object.values(StaffRole).includes(role)) return { error: "Please choose a role." };
  if (await prisma.account.findUnique({ where: { email } })) return { error: "An account with this email already exists." };

  const tempPassword = temporaryPassword();
  await prisma.account.create({
    data: {
      email,
      kind: "staff",
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
      staff: { create: { fullName, role } },
    },
  });
  await audit(me.accountId, "Staff user added", email, { name: fullName, role });
  await sendEmail({
    to: email,
    subject: "Your Recreation staff portal account",
    text: `Hello ${fullName},\n\nYou now have a ${roleLabel[role]} account on the Recreation staff portal.\nSign in at ${appUrl("/login")} with this email. Your temporary password is given to you in person by ${me.staff.fullName}; you will be asked to choose your own the first time you sign in.`,
  });
  revalidatePath("/staff/users");
  return { ok: `${fullName} can now sign in as ${roleLabel[role]}.`, tempPassword };
}

export async function setStaffActive(fd: FormData) {
  const me = await requirePermission("manageUsers");
  const id = field(fd, "id");
  const active = field(fd, "active") === "true";
  if (id === me.accountId) throw new Error("You cannot disable your own account.");
  const staff = await prisma.staffUser.update({ where: { id }, data: { active }, include: { account: true } });
  if (!active) await prisma.session.deleteMany({ where: { accountId: id } });
  await audit(me.accountId, active ? "Staff user enabled" : "Staff user disabled", staff.account.email);
  revalidatePath("/staff/users");
}

/** Switches a user between admin and staff. You cannot change your own role, so there is always an admin left. */
export async function setStaffRole(fd: FormData) {
  const me = await requirePermission("manageUsers");
  const id = field(fd, "id");
  const role = field(fd, "role") as StaffRole;
  if (id === me.accountId) throw new Error("You cannot change your own role.");
  if (!Object.values(StaffRole).includes(role)) throw new Error("Unknown role.");
  const staff = await prisma.staffUser.update({ where: { id }, data: { role }, include: { account: true } });
  await audit(me.accountId, "Staff role changed", staff.account.email, { role: roleLabel[role] });
  revalidatePath("/staff/users");
}

export async function resetStaffPassword(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requirePermission("manageUsers");
  const id = field(fd, "id");
  const tempPassword = temporaryPassword();
  const account = await prisma.account.update({
    where: { id },
    data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
  });
  await prisma.session.deleteMany({ where: { accountId: id } });
  await audit(me.accountId, "Staff password reset", account.email);
  return { ok: "Password reset. Give them this temporary password:", tempPassword };
}

// ---------- Membership applications ----------

export async function approveApplication(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requirePermission("approveMembership");
  const id = field(fd, "id");
  const gymqNumber = field(fd, "gymqNumber");
  const startsOn = field(fd, "startsOn");
  if (!gymqNumber) return { error: "Enter the membership number given by GymQ." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) return { error: "Choose the start date." };
  if (fd.get("checked") !== "on" || fd.get("inGymq") !== "on") {
    return { error: "Tick that the details are checked and the member is in GymQ." };
  }

  const m = await prisma.membership.findUnique({ where: { id }, include: { customer: true } });
  if (!m || m.status !== "paid_waiting_review") return { error: "This application is not waiting for review." };
  if (await prisma.membership.findFirst({ where: { gymqNumber, NOT: { id } } })) {
    return { error: `GymQ number ${gymqNumber} is already on another membership.` };
  }

  const start = new Date(`${startsOn}T00:00:00Z`);
  const end = addMonths(start, durationMonths[m.duration]);
  end.setUTCDate(end.getUTCDate() - 1); // last valid day
  await prisma.$transaction([
    prisma.membership.update({
      where: { id },
      data: { status: "approved", gymqNumber, startsOn: start, endsOn: end },
    }),
    prisma.customer.update({ where: { id: m.customerId }, data: { kind: "member" } }),
  ]);
  await audit(me.accountId, "Application approved", m.applicationRef, { gymqNumber });
  if (m.customer.email) {
    await sendEmail({
      to: m.customer.email,
      subject: "Your Hiltonia Club membership is approved",
      text: `Hello ${m.customer.fullName},\n\nYour ${planText(m.category, m.duration)} membership is approved.\nMembership number: ${gymqNumber}\nValid from ${startsOn} to ${end.toISOString().slice(0, 10)}.\n\nCollect your card at the Recreation desk. You can see your membership any time at ${appUrl("/membership/me")}.`,
    });
  }
  revalidatePath("/staff/applications");
  return { ok: "Approved. The member has been emailed." };
}

export async function rejectApplication(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requirePermission("approveMembership");
  const id = field(fd, "id");
  const reason = field(fd, "reason");
  if (reason.length < 5) return { error: "Please give the reason. The applicant will see it." };
  const m = await prisma.membership.findUnique({ where: { id }, include: { customer: true } });
  if (!m || (m.status !== "paid_waiting_review" && m.status !== "profile_pending")) {
    return { error: "This application cannot be rejected now." };
  }

  await prisma.membership.update({ where: { id }, data: { status: "rejected", rejectionReason: reason } });
  await prisma.session.deleteMany({ where: { account: { customerId: m.customerId } } });
  await audit(me.accountId, "Application rejected", m.applicationRef, { reason });
  if (m.customer.email) {
    await sendEmail({
      to: m.customer.email,
      subject: "About your Hiltonia Club membership application",
      text: `Hello ${m.customer.fullName},\n\nWe are sorry, your membership application ${m.applicationRef} was not approved.\nReason: ${reason}\n\nYour temporary card no longer works. The Hotel will contact you about the payment.`,
    });
  }
  revalidatePath("/staff/applications");
  return { ok: "Rejected. The applicant has been emailed the reason." };
}

export async function markCardIssued(fd: FormData) {
  const me = await requirePermission("approveMembership");
  const id = field(fd, "id");
  const m = await prisma.membership.update({ where: { id, status: "approved" }, data: { cardIssuedAt: new Date() } });
  await audit(me.accountId, "Card issued", m.applicationRef);
  revalidatePath("/staff/applications");
}

/**
 * Admin adds a member at the desk: records who they are, the plan and the payment taken at the desk
 * (or none, for someone who already paid before this system). The member is emailed a profile link,
 * then the application goes through the normal review and approval.
 */
export async function addMember(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requirePermission("addMembers");
  const fullName = field(fd, "fullName").slice(0, 120);
  const email = emailOf(fd);
  const phone = field(fd, "phone").slice(0, 40);
  const category = field(fd, "category");
  const duration = field(fd, "duration");
  const method = field(fd, "method");
  const receiptRef = field(fd, "receiptRef").slice(0, 80);
  const amountText = field(fd, "amount").replace(/[₦,\s]/g, "");
  if (!fullName || !phone) return { error: "Please enter their name and phone number." };
  if (!isEmail(email)) return { error: "Please enter a valid email. Their profile link is sent there." };
  if (!category) return { error: "Please choose a membership category." };
  if (!isDuration(duration)) return { error: "Please choose a membership length." };
  const paidAtDesk = method === "pos" || method === "cash" || method === "transfer";
  if (!paidAtDesk && method !== "none") return { error: "Please choose how they paid." };

  let amountKobo: bigint | null = null;
  if (paidAtDesk) {
    if (amountText) {
      if (!/^\d+$/.test(amountText) || Number(amountText) <= 0) return { error: "Enter the amount paid in naira, e.g. 150000." };
      amountKobo = BigInt(amountText) * BigInt(100);
    } else {
      amountKobo = await priceFor(category, duration);
      if (amountKobo == null) return { error: "This plan has no price set. Enter the amount paid." };
    }
    if (!receiptRef) return { error: "Enter the receipt or transaction reference." };
  }

  const existing = await prisma.account.findUnique({
    where: { email },
    include: { customer: { include: { memberships: true } } },
  });
  if (existing?.kind === "staff") return { error: "This email belongs to a staff account. Use the member's personal email." };
  const today = new Date();
  const live = existing?.customer?.memberships.find(
    (m) =>
      m.status === "profile_pending" ||
      m.status === "paid_waiting_review" ||
      (m.status === "approved" && (!m.endsOn || m.endsOn >= today)),
  );
  if (live) return { error: `This email already has a membership (${live.applicationRef}).` };

  const applicationRef = await nextApplicationRef();
  const { membership, accountId } = await prisma.$transaction(async (tx) => {
    const customer = existing?.customer
      ? await tx.customer.update({ where: { id: existing.customer.id }, data: { fullName, phone, email } })
      : await tx.customer.create({ data: { kind: "member", fullName, phone, email } });
    const account = existing
      ? await tx.account.update({ where: { id: existing.id }, data: { customerId: customer.id } })
      : await tx.account.create({ data: { email, kind: "member", customerId: customer.id } });
    const membership = await tx.membership.create({
      data: { applicationRef, customerId: customer.id, category, duration, status: "profile_pending" },
    });
    if (paidAtDesk && amountKobo != null) {
      await tx.payment.create({
        data: {
          membershipId: membership.id,
          method: method as "pos" | "cash" | "transfer",
          status: "succeeded",
          amountKobo,
          receiptRef,
          recordedBy: me.accountId,
        },
      });
    }
    return { membership, accountId: account.id };
  });

  await audit(me.accountId, "Member added at desk", applicationRef, {
    name: fullName,
    plan: planText(category, duration),
    payment: paidAtDesk ? { method, amountKobo: amountKobo?.toString(), receiptRef } : "none recorded",
  });
  const token = await createProfileToken(accountId, membership.id);
  await sendEmail({
    to: email,
    subject: "Complete your Hiltonia Club membership profile",
    text: `Hello ${fullName},\n\nThe Recreation desk has set up your ${planText(category, duration)} membership (application ${applicationRef}).\nPlease complete your membership profile here (link works for 14 days):\n${appUrl(`/membership/apply?token=${token}`)}\n\nOnce your profile is in, you get a temporary card while the Recreation team checks it.`,
  });
  revalidatePath("/staff/members");
  revalidatePath("/staff/applications");
  // Back to the register, which shows the new member and a confirmation (and closes the popup).
  redirect(`/staff/members?show=pending&added=${applicationRef}`);
}

/** Sends a fresh "complete your profile" link to someone who paid but has not finished. */
export async function resendProfileLink(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireStaff();
  if (!can(me.staff.role, "approveMembership") && !can(me.staff.role, "bookAndVerify")) {
    return { error: "You do not have permission to do this." };
  }
  const id = field(fd, "id");
  const m = await prisma.membership.findUnique({ where: { id }, include: { customer: { include: { account: true } } } });
  if (!m || m.status !== "profile_pending" || !m.customer.account || !m.customer.email) {
    return { error: "This application is not waiting for a profile." };
  }
  // Old links stop working.
  await prisma.accountToken.updateMany({
    where: { membershipId: id, purpose: "complete_profile", usedAt: null },
    data: { usedAt: new Date() },
  });
  const token = await createProfileToken(m.customer.account.id, m.id);
  await sendEmail({
    to: m.customer.email,
    subject: "Reminder: complete your Hiltonia Club membership profile",
    text: `Hello ${m.customer.fullName},\n\nYour payment for ${planText(m.category, m.duration)} is received, but your membership profile is not finished yet.\nComplete it here (link works for 14 days):\n${appUrl(`/membership/apply?token=${token}`)}`,
  });
  await audit(me.accountId, "Profile link resent", m.applicationRef);
  return { ok: `A new link was emailed to ${m.customer.email}.` };
}
