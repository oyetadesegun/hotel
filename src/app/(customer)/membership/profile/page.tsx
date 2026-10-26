import type { Metadata } from "next";
import { PageHeader } from "@/src/components/customer";
import { MembershipProfileForm } from "@/src/components/MembershipProfileForm";
import { Button, Chip, KV, Notice } from "@/src/components/ui";
import { requireMember } from "@/src/lib/auth/session";
import { latestMembership, planText } from "@/src/lib/membership";
import { profileSections, type MembershipProfile } from "@/src/lib/profile";

export const metadata: Metadata = { title: "My membership profile" };
export const instant = false;

/**
 * The signed-in member's application form. Fill it in after paying to get a temporary card,
 * and update it while the application is waiting for review. Once approved it is read-only.
 */
export default async function MyProfilePage() {
  const me = await requireMember();
  const m = await latestMembership(me.customerId);
  const saved = (m?.profile ?? null) as MembershipProfile | null;
  const prefill = { name: m?.customer.fullName ?? "", email: m?.customer.email ?? me.email, phone: m?.customer.phone ?? "" };

  return (
    <>
      <PageHeader title="My profile" back="/membership/me" />
      <div className="flex flex-1 flex-col gap-3.5 px-5 pb-5 pt-1">
        {!m ? (
          <>
            <Notice>You have no membership yet.</Notice>
            <Button href="/membership" full>
              See membership plans
            </Button>
          </>
        ) : (
          <>
            <div className="text-xs text-charcoal">
              {planText(m.category, m.duration)} · Application ref <b className="text-black">{m.applicationRef}</b>
            </div>

            {m.status === "profile_pending" && (
              <>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-warn-bg px-3.5 py-3 text-warn-fg">
                  <span className="text-[13px] leading-snug">
                    <b>Payment received.</b> Finish this form to get your temporary card.
                  </span>
                  <Chip tone="warn" className="shrink-0 bg-white/60">
                    Pending
                  </Chip>
                </div>
                <MembershipProfileForm prefill={prefill} />
              </>
            )}

            {m.status === "paid_waiting_review" && (
              <>
                <Notice tone="info">
                  The Recreation team is checking your application. You can still correct your details here until it is
                  approved.
                </Notice>
                <MembershipProfileForm prefill={prefill} saved={saved} hasPhoto={m.photoPath != null} />
              </>
            )}

            {m.status === "rejected" && (
              <Notice tone="bad">Your application was not approved. Reason: {m.rejectionReason}</Notice>
            )}

            {m.status === "approved" && (
              <>
                <Notice>Your membership is approved. To change these details, please ask the Recreation desk.</Notice>
                {saved &&
                  profileSections(saved).map((s) => (
                    <section key={s.title} className="rounded-2xl bg-white px-4 py-3">
                      <h2 className="mb-1 text-sm font-bold">{s.title}</h2>
                      <KV rows={s.rows} />
                    </section>
                  ))}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
