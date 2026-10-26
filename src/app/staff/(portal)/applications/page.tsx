import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/src/lib/db";
import { requireStaff } from "@/src/lib/auth/session";
import { can } from "@/src/lib/auth/roles";
import { dateOnly, dateTime, naira, todayIso } from "@/src/lib/format";
import { planText, statusLabel, toNaira } from "@/src/lib/membership";
import { profileSections, type MembershipProfile } from "@/src/lib/profile";
import { ActionForm } from "@/src/components/ActionForm";
import { MembershipCard } from "@/src/components/MembershipCard";
import { Button, Card, CheckRow, Chip, Field, KV, Notice, cn, type Tone } from "@/src/components/ui";
import { Col, Cols, PageTitle } from "@/src/components/staff";
import type { ApplicationStatus, Prisma } from "@/src/generated/prisma/client";
import { approveApplication, markCardIssued, rejectApplication, resendProfileLink } from "../../actions";

export const metadata: Metadata = { title: "Membership applications" };

const tone: Record<ApplicationStatus, Tone> = {
  profile_pending: "warn",
  paid_waiting_review: "info",
  approved: "ok",
  rejected: "bad",
};

const tabs = {
  review: { label: "To review", where: { status: "paid_waiting_review" } },
  pending: { label: "Profile pending", where: { status: "profile_pending" } },
  print: { label: "Card to print", where: { status: "approved", cardIssuedAt: null } },
  approved: { label: "Approved", where: { status: "approved" } },
  rejected: { label: "Rejected", where: { status: "rejected" } },
  all: { label: "All", where: {} },
} satisfies Record<string, { label: string; where: Prisma.MembershipWhereInput }>;
type Tab = keyof typeof tabs;

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; id?: string }>;
}) {
  const me = await requireStaff();
  const q = await searchParams;
  const tab: Tab = q.tab && q.tab in tabs ? (q.tab as Tab) : "review";

  const [counts, list] = await Promise.all([
    Promise.all(Object.values(tabs).map((t) => prisma.membership.count({ where: t.where }))),
    prisma.membership.findMany({
      where: tabs[tab].where,
      include: { customer: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const selectedId = q.id ?? list[0]?.id;
  const selected = selectedId
    ? await prisma.membership.findUnique({
        where: { id: selectedId },
        include: { customer: { include: { account: true } }, payments: { orderBy: { createdAt: "asc" } } },
      })
    : null;
  const lastEdit = selected
    ? await prisma.auditLog.findFirst({
        where: { item: selected.applicationRef, action: "Profile updated" },
        orderBy: { at: "desc" },
        select: { at: true },
      })
    : null;

  return (
    <>
      <PageTitle title="Membership applications" sample={false} />
      <nav className="flex flex-wrap gap-2 text-sm font-semibold" aria-label="Filter applications">
        {(Object.keys(tabs) as Tab[]).map((key, i) => (
          <Link
            key={key}
            href={`/staff/applications?tab=${key}`}
            aria-current={key === tab ? "page" : undefined}
            className={cn("flex h-10 items-center rounded-full px-4", key === tab ? "bg-charcoal text-white" : "bg-white hover:bg-neutral-bg")}
          >
            {tabs[key].label} ({counts[i]})
          </Link>
        ))}
      </nav>
      <Cols>
        <Col basis={300}>
          {list.length === 0 && (
            <div className="rounded-2xl bg-white p-5 text-sm text-charcoal">No applications here yet.</div>
          )}
          {list.map((a) => (
            <Link
              key={a.id}
              href={`/staff/applications?tab=${tab}&id=${a.id}`}
              className={cn(
                "flex flex-col gap-1.5 rounded-2xl border-2 bg-white p-3.5",
                a.id === selected?.id ? "border-primary" : "border-transparent hover:border-line",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <b className="text-[15px]">{a.customer.fullName}</b>
                <span className="text-xs text-charcoal">{dateTime(a.createdAt)}</span>
              </div>
              <div className="text-[13px] text-charcoal">
                {planText(a.category, a.duration)} · {a.applicationRef}
              </div>
              <Chip tone={tone[a.status]} className="self-start">
                {statusLabel[a.status]}
              </Chip>
            </Link>
          ))}
        </Col>
        <Col grow={2} basis={520}>{selected && <Detail m={selected} lastEdit={lastEdit?.at ?? null} canApprove={can(me.staff.role, "approveMembership")} />}</Col>
      </Cols>
    </>
  );
}

type Selected = Prisma.MembershipGetPayload<{ include: { customer: { include: { account: true } }; payments: true } }>;

function Detail({ m, lastEdit, canApprove }: { m: Selected; lastEdit: Date | null; canApprove: boolean }) {
  const paid = m.payments.filter((p) => p.status === "succeeded");
  const paidKobo = paid.reduce((sum, p) => sum + p.amountKobo, BigInt(0));
  const profile = m.profile as MembershipProfile | null;

  return (
    <Card className="gap-[18px] p-6">
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div>
          <div className="text-xs text-charcoal">Application reference</div>
          <h2 className="mt-0.5 text-xl font-bold">{m.applicationRef}</h2>
        </div>
        <Chip tone={tone[m.status]} className="px-3 py-1">
          {statusLabel[m.status]}
        </Chip>
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="flex w-[190px] flex-none flex-col gap-1.5">
          <MembershipCard
            data={{
              fullName: m.customer.fullName,
              category: m.category,
              duration: m.duration,
              cardNumber: m.gymqNumber,
              applicationRef: m.applicationRef,
              expiresOn: m.endsOn?.toISOString(),
              photoUrl: m.photoPath ? `/api/membership-photo/${m.id}` : null,
            }}
          />
          <span className="text-center text-xs text-charcoal">
            {m.gymqNumber ? "Card as printed." : "Card preview. The number fills in from GymQ."}
          </span>
        </div>
        <div className="min-w-64 flex-1">
          <KV
            rows={[
              ["Name", m.customer.fullName],
              ["Phone", m.customer.phone ?? "-"],
              ["Email", m.customer.email ?? "-"],
              ["Plan", planText(m.category, m.duration)],
              ["Paid", paid.length ? `${naira(toNaira(paidKobo))}, ${paid.map((p) => p.method).join(", ")}` : "No payment recorded"],
              ["Payment reference", paid.map((p) => p.gatewayRef ?? p.receiptRef ?? "-").join(", ") || "-"],
              ["Paid on", paid[0] ? dateTime(paid[0].createdAt) : "-"],
              ["Profile completed", m.profileCompletedAt ? dateTime(m.profileCompletedAt) : "Not yet"],
              ...(lastEdit ? ([["Profile last changed by member", dateTime(lastEdit)]] as [string, string][]) : []),
              ["Member last signed in", m.customer.account?.lastSignInAt ? dateTime(m.customer.account.lastSignInAt) : "Never"],
              ...(m.gymqNumber
                ? ([
                    ["GymQ number", m.gymqNumber],
                    ["Valid", `${dateOnly(m.startsOn)} to ${dateOnly(m.endsOn)}`],
                    ["Card", m.cardIssuedAt ? `Issued ${dateTime(m.cardIssuedAt)}` : "Not issued yet"],
                  ] as [string, string][])
                : []),
            ]}
          />
          {paid.some((p) => p.gatewayRef?.startsWith("TEST-")) && (
            <p className="mt-2 text-xs text-warn-fg">Paid in test mode: no real money moved.</p>
          )}
        </div>
      </div>

      {profile ? (
        <div className="grid gap-4 md:grid-cols-2">
          {profileSections(profile).map((s) => (
            <section key={s.title} className="rounded-xl border border-line p-3.5">
              <h3 className="mb-1 text-sm font-bold">{s.title}</h3>
              <KV rows={s.rows} />
            </section>
          ))}
        </div>
      ) : (
        m.status === "profile_pending" && (
          <Notice tone="warn">
            Paid on {paid[0] ? dateTime(paid[0].createdAt) : "-"}, but the applicant has not completed their profile yet.
          </Notice>
        )
      )}

      <div className="h-px bg-line" />

      {m.status === "paid_waiting_review" &&
        (canApprove ? (
          <div className="grid gap-5 md:grid-cols-2">
            <ActionForm action={approveApplication} submitLabel="Approve and activate" pendingLabel="Approving…">
              <h3 className="text-[15px] font-bold">Approve</h3>
              <input type="hidden" name="id" value={m.id} />
              <CheckRow name="checked">Details and photo checked</CheckRow>
              <CheckRow name="inGymq">Member entered in GymQ</CheckRow>
              <Field
                label="Membership number given by GymQ"
                id="gymqNumber"
                required
                hint="Numbers come from GymQ only. This system never creates one."
                className="basis-full"
              />
              <Field label="Membership starts on" id="startsOn" type="date" defaultValue={todayIso()} required className="basis-full" />
            </ActionForm>
            <ActionForm action={rejectApplication} submitLabel="Reject with reason" pendingLabel="Rejecting…" variant="secondary">
              <h3 className="text-[15px] font-bold">Reject</h3>
              <input type="hidden" name="id" value={m.id} />
              <Field label="Reason (the applicant sees this)" id="reason" required className="basis-full" />
              <Notice>
                The temporary card stops working and the applicant is emailed the reason. The Hotel decides on any refund.
              </Notice>
            </ActionForm>
          </div>
        ) : (
          <Notice>Only staff with approval rights can approve or reject applications.</Notice>
        ))}

      {m.status === "profile_pending" && (
        <div className="grid gap-5 md:grid-cols-2">
          <ActionForm action={resendProfileLink} submitLabel="Email a new profile link" pendingLabel="Sending…" variant="secondary">
            <input type="hidden" name="id" value={m.id} />
            <p className="text-[13px] text-charcoal">
              The member can also sign in and finish it under My profile. This emails {m.customer.email} a fresh link that
              signs them straight in. Older links stop working.
            </p>
          </ActionForm>
          {canApprove && (
            <ActionForm action={rejectApplication} submitLabel="Reject with reason" pendingLabel="Rejecting…" variant="secondary">
              <input type="hidden" name="id" value={m.id} />
              <Field label="Reason (the applicant sees this)" id="reason" required className="basis-full" />
            </ActionForm>
          )}
        </div>
      )}

      {m.status === "approved" && !m.cardIssuedAt && canApprove && (
        <form action={markCardIssued} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={m.id} />
          <Button type="submit" size="md">
            Mark physical card as issued
          </Button>
          <span className="text-[13px] text-charcoal">Do this when the member collects their card.</span>
        </form>
      )}

      {m.status === "rejected" && <Notice tone="bad">Rejected: {m.rejectionReason}</Notice>}
    </Card>
  );
}
