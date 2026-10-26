import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/src/lib/auth/session";
import { ActionForm } from "@/src/components/ActionForm";
import { AuthCard } from "@/src/components/AuthCard";
import { Field } from "@/src/components/ui";
import { changeOwnPassword } from "../actions";

export const metadata: Metadata = { title: "Change your password" };
export const instant = false;

export default async function ChangePasswordPage() {
  const me = await requireStaff();
  return (
    <AuthCard
      title={me.mustChangePassword ? "Choose your password" : "Change your password"}
      sub={me.mustChangePassword ? "You signed in with a temporary password. Choose your own to continue." : undefined}
    >
      <ActionForm action={changeOwnPassword} submitLabel="Save password">
        <Field
          label={me.mustChangePassword ? "Temporary password" : "Current password"}
          id="current"
          type="password"
          autoComplete="current-password"
          required
          className="basis-full"
        />
        <Field
          label="New password"
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          hint="At least 10 characters, with letters and a number."
          className="basis-full"
        />
        <Field label="Confirm new password" id="confirm" type="password" autoComplete="new-password" required className="basis-full" />
      </ActionForm>
      {!me.mustChangePassword && (
        <Link href="/staff" className="text-center text-[13px] font-semibold text-link">
          Back to the portal
        </Link>
      )}
    </AuthCard>
  );
}
