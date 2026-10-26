import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/src/components/customer";
import { MembershipProfileForm } from "@/src/components/MembershipProfileForm";
import { Button, Chip, Notice } from "@/src/components/ui";
import { prisma } from "@/src/lib/db";
import { findProfileToken, planText } from "@/src/lib/membership";

export const metadata: Metadata = { title: "Complete your membership profile" };

type SearchParams = Promise<{ token?: string }>;

/**
 * Opened from a "complete your profile" link that staff can email (Resend link on /staff/applications).
 * The link carries a one-time token and signs the member in when the form is saved.
 * Members who chose a password when paying can also sign in and use /membership/profile.
 */
export default function CompleteProfilePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader title="Complete your profile" back="/membership" />
      <div className="flex flex-1 flex-col gap-3.5 px-5 pb-5 pt-1">
        <Suspense fallback={<p className="text-sm text-charcoal">Loading your application…</p>}>
          <ProfileBody searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

async function ProfileBody({ searchParams }: { searchParams: SearchParams }) {
  const { token = "" } = await searchParams;
  const found = await findProfileToken(token);

  if (!found) {
    return (
      <div className="flex flex-1 flex-col gap-3.5">
        <Notice tone="warn">
          This link has expired, was already used, or is not complete. If you have finished your profile, sign in to see
          your membership. Otherwise sign in to finish it, or ask the Recreation desk to email you a new link.
        </Notice>
        <Button href="/login?next=/membership/profile" full>
          Sign in
        </Button>
      </div>
    );
  }

  const { membership: m, token: row } = found;
  const account = await prisma.account.findUnique({ where: { id: row.accountId }, select: { passwordHash: true } });
  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-xl bg-warn-bg px-3.5 py-3 text-warn-fg">
        <span className="text-[13px] leading-snug">
          <b>Payment received.</b> Your membership is pending until you finish this form.
        </span>
        <Chip tone="warn" className="shrink-0 bg-white/60">
          Pending
        </Chip>
      </div>
      <div className="text-xs text-charcoal">
        {planText(m.category, m.duration)} · Application ref <b className="text-black">{m.applicationRef}</b>
      </div>
      <MembershipProfileForm
        token={token}
        needsPassword={!account?.passwordHash}
        prefill={{ name: m.customer.fullName, email: m.customer.email ?? "", phone: m.customer.phone ?? "" }}
      />
    </>
  );
}
