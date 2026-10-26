import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/db";
import { ActionForm } from "@/src/components/ActionForm";
import { AuthCard } from "@/src/components/AuthCard";
import { Field } from "@/src/components/ui";
import { setupFirstAdmin } from "../actions";

export const metadata: Metadata = { title: "Set up the staff portal" };
export const instant = false;

/** First run only: creates the first admin. Disappears once any staff account exists. */
export default async function SetupPage() {
  await connection();
  if ((await prisma.staffUser.count()) > 0) redirect("/login");

  return (
    <AuthCard
      title="Set up the staff portal"
      sub="There are no staff accounts yet. Create the first one: an admin, who then adds everyone else."
    >
      <ActionForm action={setupFirstAdmin} submitLabel="Create admin account" pendingLabel="Creating…">
        <Field label="Your full name" id="fullName" autoComplete="name" required className="basis-full" />
        <Field label="Work email" id="email" type="email" autoComplete="username" required className="basis-full" />
        <Field
          label="Password"
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          hint="At least 10 characters, with letters and a number."
          className="basis-full"
        />
        <Field label="Confirm password" id="confirm" type="password" autoComplete="new-password" required className="basis-full" />
      </ActionForm>
    </AuthCard>
  );
}
