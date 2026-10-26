import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Mail } from "lucide-react";
import { BottomNav } from "@/src/components/BottomNav";
import { Button, Notice } from "@/src/components/ui";
import { AsideCard, WebPage, WithAside } from "@/src/components/web";
import { prisma } from "@/src/lib/db";
import { getSignedIn } from "@/src/lib/auth/session";
import { dateTime } from "@/src/lib/format";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <>
      <WebPage eyebrow="MESSAGES" title="Keeping you" accent="in the loop." sub="Every email we send you also lands here.">
        <WithAside
          aside={
            <>
              <AsideCard title="How we reach you">
                <p className="flex items-start gap-2.5 text-[13px] leading-relaxed text-charcoal">
                  <Mail size={16} className="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
                  Payment receipts, profile links and membership updates go to the email you paid with.
                </p>
                <p className="text-[13px] leading-relaxed text-charcoal">Not seeing an email? Check your spam folder.</p>
              </AsideCard>
              <AsideCard title="Quick links">
                <Link href="/membership/me" className="text-[13px] font-bold text-link hover:underline">
                  My membership
                </Link>
                <Link href="/membership" className="text-[13px] font-bold text-link hover:underline">
                  Membership and rates
                </Link>
                <Link href="/terms" className="text-[13px] font-bold text-link hover:underline">
                  Terms and conditions
                </Link>
              </AsideCard>
            </>
          }
        >
          <Suspense fallback={<p className="text-sm text-charcoal">Loading your messages…</p>}>
            <Messages />
          </Suspense>
        </WithAside>
      </WebPage>
      <BottomNav />
    </>
  );
}

async function Messages() {
  const me = await getSignedIn();
  if (me?.kind !== "member") {
    return (
      <div className="flex flex-col gap-3">
        <Notice>Members: sign in to see the messages we have sent you.</Notice>
        <Button href="/login" className="self-start">
          Sign in
        </Button>
      </div>
    );
  }

  const sent = await prisma.auditLog.findMany({
    where: { action: "Email sent", item: me.email },
    orderBy: { at: "desc" },
    take: 100,
  });
  if (sent.length === 0) return <Notice>No messages yet.</Notice>;

  return (
    <ul className="flex flex-col gap-2.5">
      {sent.map((m) => (
        <li key={String(m.id)} className="flex gap-3.5 rounded-2xl border border-line bg-white p-4 md:p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-link">
            <Mail size={18} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <b className="text-[15px]">{(m.details as { subject?: string } | null)?.subject ?? "Email"}</b>
            <small className="text-xs text-charcoal">{dateTime(m.at)}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}
