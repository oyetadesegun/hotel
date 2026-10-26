import type { Metadata } from "next";
import { BottomNav } from "@/src/components/BottomNav";
import { MembershipCard } from "@/src/components/MembershipCard";
import { Button, Chip, KV, Notice, type Tone } from "@/src/components/ui";
import { requireMember } from "@/src/lib/auth/session";
import { dateOnly, naira } from "@/src/lib/format";
import { durationLabel, latestMembership, statusLabel, toNaira } from "@/src/lib/membership";
import { signOut } from "@/src/app/login/actions";

export const metadata: Metadata = { title: "My membership" };
export const instant = false;

export default async function MyMembershipPage({ searchParams }: PageProps<"/membership/me">) {
  const [me, { updated }] = await Promise.all([requireMember(), searchParams]);
  const m = await latestMembership(me.customerId);

  const today = new Date();
  const expired = m?.status === "approved" && m.endsOn != null && m.endsOn < today;
  const badge: { text: string; tone: Tone } | null = !m
    ? null
    : expired
      ? { text: "Expired", tone: "bad" }
      : m.status === "approved"
        ? { text: "Active", tone: "ok" }
        : m.status === "paid_waiting_review"
          ? { text: "Temporary, under review", tone: "info" }
          : { text: statusLabel[m.status], tone: m.status === "rejected" ? "bad" : "warn" };
  const paidKobo = m?.payments.reduce((s, p) => s + p.amountKobo, BigInt(0));

  return (
    <>
      <header className="flex items-center justify-between border-b border-line px-5 pb-3.5 pt-5">
        <h1 className="text-2xl font-bold">My membership</h1>
        <form action={signOut}>
          <button type="submit" className="text-sm font-semibold text-link hover:underline">
            Sign out
          </button>
        </form>
      </header>
      <div className="flex flex-1 flex-col gap-3.5 bg-surface px-5 py-4">
        {updated && <Notice tone="ok">Your profile changes are saved. The Recreation team sees the new details.</Notice>}
        {!m ? (
          <Notice>You have no membership yet.</Notice>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2">
              {m.status !== "rejected" && (
                <MembershipCard
                  data={{
                    fullName: m.customer.fullName,
                    category: m.category,
                    duration: m.duration,
                    cardNumber: m.status === "approved" ? m.gymqNumber : null,
                    applicationRef: m.applicationRef,
                    expiresOn: m.endsOn?.toISOString(),
                    photoUrl: m.photoPath ? `/api/membership-photo/${m.id}` : null,
                  }}
                />
              )}
              {badge && <Chip tone={badge.tone}>{badge.text}</Chip>}
            </div>

            {m.status === "profile_pending" && (
              <Notice tone="warn">
                Your payment is in, but your profile is not finished. Complete it to get your temporary card.
              </Notice>
            )}
            {m.status === "rejected" && <Notice tone="bad">Your application was not approved. Reason: {m.rejectionReason}</Notice>}
            {m.status === "paid_waiting_review" && (
              <Notice tone="info">
                The Recreation Manager is checking your application. We will email you your membership number when it is
                approved.
              </Notice>
            )}

            <section className="rounded-2xl bg-white px-4 py-1.5">
              <KV
                rows={[
                  ["Name", m.customer.fullName],
                  ["Category", m.category],
                  ["Length", durationLabel[m.duration]],
                  ["Application ref", m.applicationRef],
                  ["Membership no.", m.gymqNumber ?? "Pending"],
                  ["Valid", m.startsOn ? `${dateOnly(m.startsOn)} to ${dateOnly(m.endsOn)}` : "Starts when approved"],
                  ["Paid", paidKobo ? naira(toNaira(paidKobo)) : "-"],
                  ["Card", m.cardIssuedAt ? "Collected" : m.status === "approved" ? "Ready to collect at the Recreation desk" : "Not issued yet"],
                ]}
              />
            </section>
            {m.status === "approved" && (
              <section className="rounded-2xl bg-white p-4 text-[13px] leading-relaxed">
                <b className="text-sm">Renewal</b>
                <br />
                We will remind you 30 days before your membership ends. Ask the Recreation desk to renew.
              </section>
            )}
          </>
        )}
        <div className="flex-1" />
        {m?.status === "profile_pending" && (
          <Button href="/membership/profile" full>
            Complete my profile
          </Button>
        )}
        {m?.status === "paid_waiting_review" && (
          <Button href="/membership/profile" full>
            Update my profile
          </Button>
        )}
        {m?.status === "approved" && (
          <Button href="/membership/profile" full variant="secondary">
            View my profile
          </Button>
        )}
        {m && m.status !== "approved" && m.status !== "rejected" && (
          <Button href="/membership/card" full variant="secondary">
            See my application progress
          </Button>
        )}
      </div>
      <BottomNav />
    </>
  );
}
