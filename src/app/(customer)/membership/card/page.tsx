import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MembershipCard } from "@/src/components/MembershipCard";
import { Button, CheckIcon, Notice, cn } from "@/src/components/ui";
import { requireMember } from "@/src/lib/auth/session";
import { latestMembership } from "@/src/lib/membership";

export const metadata: Metadata = { title: "Temporary member card" };
export const instant = false;

export default async function TemporaryCardPage() {
  const me = await requireMember();
  const m = await latestMembership(me.customerId);
  if (!m || m.status === "approved" || m.status === "rejected") redirect("/membership/me");

  const steps = [
    { label: "Payment received", done: m.payments.length > 0 },
    { label: "Profile completed", done: m.profileCompletedAt != null },
    { label: "Recreation Manager is checking your details", done: false },
    { label: "Membership number issued", done: false },
    { label: "Collect your physical card at the Recreation desk", done: false },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-7">
      <ol className="flex gap-1.5 text-xs font-semibold">
        {["1 Pay", "2 Profile", "3 Card"].map((s, i) => (
          <li
            key={s}
            className={cn("flex-1 rounded-full py-1.5 text-center", i === 2 ? "bg-charcoal text-white" : "bg-neutral-bg text-charcoal")}
          >
            {s}
          </li>
        ))}
      </ol>
      <h1 className="mt-1.5 text-[26px] font-bold leading-tight">
        {m.status === "profile_pending" ? "Payment received" : "Profile complete"}
      </h1>
      <p className="text-sm leading-relaxed text-charcoal">
        {m.status === "profile_pending"
          ? "Finish your profile to get your temporary card."
          : "Here is your temporary card. Your membership number appears on it once the Recreation Manager approves you."}
      </p>
      {m.status === "paid_waiting_review" && (
        <MembershipCard
          className="self-center"
          data={{
            fullName: m.customer.fullName,
            category: m.category,
            duration: m.duration,
            applicationRef: m.applicationRef,
            photoUrl: m.photoPath ? `/api/membership-photo/${m.id}` : null,
          }}
        />
      )}
      {m.status === "profile_pending" && <Notice tone="warn">Your profile is not finished yet.</Notice>}
      <ol className="mt-1 flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-start gap-3 text-sm">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                s.done ? "bg-ok-bg text-ok-fg" : i === current ? "bg-warn-bg text-warn-fg" : "bg-neutral-bg text-charcoal",
              )}
            >
              {s.done ? <CheckIcon size={14} /> : i + 1}
            </span>
            <span className={cn(s.done || i === current ? "font-bold" : "text-charcoal")}>{s.label}</span>
          </li>
        ))}
      </ol>
      <p className="text-xs leading-relaxed text-charcoal">We will email you when your membership number is issued.</p>
      <div className="flex-1" />
      {m.status === "profile_pending" ? (
        <Button href="/membership/profile" full>
          Complete my profile
        </Button>
      ) : (
        <Button href="/membership/profile" full variant="secondary">
          Update my profile
        </Button>
      )}
      <Button href="/membership/me" full variant={m.status === "profile_pending" ? "secondary" : "primary"}>
        My membership
      </Button>
    </main>
  );
}
