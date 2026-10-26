import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/db";
import { getSignedIn } from "@/src/lib/auth/session";
import { AuthCard } from "@/src/components/AuthCard";
import { SignInForm } from "@/src/components/SignInForm";

export const metadata: Metadata = { title: "Sign in" };
export const instant = false;

/** The one sign-in page for members and staff. */
export default async function SignInPage({ searchParams }: PageProps<"/login">) {
  await connection();
  const me = await getSignedIn();
  if (me) redirect(me.kind === "staff" ? "/staff" : "/membership/me");
  const [{ next }, staffCount] = await Promise.all([searchParams, prisma.staffUser.count()]);

  return (
    <AuthCard title="Welcome back" sub="Members and staff sign in here with their email and password.">
      <SignInForm next={typeof next === "string" ? next : ""} />
      <div className="flex flex-col gap-2 border-t border-line pt-4 text-[13px] leading-relaxed text-charcoal">
        <p>
          Not a member yet?{" "}
          <Link href="/membership" className="font-semibold text-link underline">
            See membership plans
          </Link>
        </p>
        <p>Forgot your password? Members, ask the Recreation desk. Staff, ask an admin.</p>
        {staffCount === 0 && (
          <p>
            Setting up for the first time?{" "}
            <Link href="/staff/setup" className="font-semibold text-link underline">
              Create the first admin
            </Link>
          </p>
        )}
      </div>
    </AuthCard>
  );
}
