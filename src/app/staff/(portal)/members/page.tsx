import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/src/lib/db";
import { requireStaff } from "@/src/lib/auth/session";
import { dateOnly } from "@/src/lib/format";
import { can } from "@/src/lib/auth/roles";
import { currentRates, durationLabel, planText } from "@/src/lib/membership";
import { ActionForm } from "@/src/components/ActionForm";
import { DialogButton } from "@/src/components/DialogButton";
import { Button, Chip, Field, Notice, cn, inputClass, type Tone } from "@/src/components/ui";
import { Empty, PageTitle, TableCard } from "@/src/components/staff";
import { Table } from "@/src/components/table";
import type { Prisma } from "@/src/generated/prisma/client";
import { addMember } from "../../actions";

export const metadata: Metadata = { title: "Member register" };

const filters = ["all", "active", "expiring", "expired", "temporary", "pending"] as const;
type Filter = (typeof filters)[number];
const filterLabel: Record<Filter, string> = {
  all: "All",
  active: "Active",
  expiring: "Expiring in 30 days",
  expired: "Expired",
  temporary: "Temporary (under review)",
  pending: "Profile not filled in",
};

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; show?: string; added?: string }> }) {
  const me = await requireStaff();
  const canAdd = can(me.staff.role, "addMembers");
  const categories = canAdd ? (await currentRates()).map((r) => r.category) : [];
  const { q = "", show, added } = await searchParams;
  const justAdded = added
    ? await prisma.membership.findUnique({ where: { applicationRef: added }, include: { customer: true } })
    : null;
  const filter: Filter = filters.includes(show as Filter) ? (show as Filter) : "all";
  const today = new Date(new Date().toISOString().slice(0, 10));
  const in30 = new Date(today.getTime() + 30 * 86_400_000);

  const byFilter: Record<Filter, Prisma.MembershipWhereInput> = {
    all: { status: { in: ["approved", "paid_waiting_review", "profile_pending"] } },
    active: { status: "approved", endsOn: { gte: today } },
    expiring: { status: "approved", endsOn: { gte: today, lte: in30 } },
    expired: { status: "approved", endsOn: { lt: today } },
    temporary: { status: "paid_waiting_review" },
    pending: { status: "profile_pending" },
  };
  const search = q.trim();
  const rows = await prisma.membership.findMany({
    where: {
      ...byFilter[filter],
      ...(search && {
        OR: [
          { gymqNumber: { contains: search, mode: "insensitive" } },
          { applicationRef: { contains: search, mode: "insensitive" } },
          { customer: { fullName: { contains: search, mode: "insensitive" } } },
          { customer: { email: { contains: search, mode: "insensitive" } } },
          { customer: { phone: { contains: search } } },
        ],
      }),
    },
    include: { customer: true },
    // Not started yet (no end date) first, newest first; then by expiry.
    orderBy: [{ endsOn: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    take: 300,
  });

  const status = (m: (typeof rows)[number]): [string, Tone] => {
    if (m.status === "profile_pending") return ["Profile not filled in", "warn"];
    if (m.status === "paid_waiting_review") return ["Temporary", "info"];
    if (m.endsOn && m.endsOn < today) return ["Expired", "bad"];
    if (m.endsOn && m.endsOn <= in30) return ["Expiring soon", "warn"];
    return ["Active", "ok"];
  };

  return (
    <>
      <PageTitle title="Member register" sub="Approved members, people with a temporary card while they are reviewed, and people who still have to fill in their profile.">
        {canAdd && (
          // A new key after each add starts a fresh, closed popup.
          <DialogButton key={added ?? "new"} label="Add a member" title="Add a member">
            <AddMemberForm categories={categories} />
          </DialogButton>
        )}
      </PageTitle>
      {justAdded && (
        <Notice tone="ok">
          <b>{justAdded.customer.fullName}</b> is added ({justAdded.applicationRef}). A profile link was emailed to {justAdded.customer.email}.
          They show as “Profile not filled in” until they complete it, then go to Applications for review.
        </Notice>
      )}
      <TableCard>
        <form className="flex flex-wrap items-center gap-2.5">
          <input type="hidden" name="show" value={filter} />
          <input
            name="q"
            defaultValue={search}
            aria-label="Search"
            placeholder="Search name, email, phone or membership number"
            className={inputClass + " h-[46px] max-w-sm"}
          />
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
        <nav className="flex flex-wrap gap-2 text-sm font-semibold" aria-label="Filter members">
          {filters.map((f) => (
            <Link
              key={f}
              href={`/staff/members?show=${f}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
              aria-current={f === filter ? "page" : undefined}
              className={cn("flex h-10 items-center rounded-full px-4", f === filter ? "bg-charcoal text-white" : "bg-surface hover:bg-neutral-bg")}
            >
              {filterLabel[f]}
            </Link>
          ))}
        </nav>
        {rows.length === 0 ? (
          <Empty>{search ? `No members match “${search}”.` : "No members here yet."}</Empty>
        ) : (
          <Table
            heads={["Name", "Membership no. (GymQ)", "Plan", "Valid to", "Status", "Card", ""]}
            rows={rows.map((m) => {
              const [label, tone] = status(m);
              return [
                <span key="n">
                  <b>{m.customer.fullName}</b>
                  <br />
                  <span className="text-xs text-charcoal">{m.customer.email}</span>
                </span>,
                m.gymqNumber ?? "Pending",
                planText(m.category, m.duration),
                m.endsOn ? dateOnly(m.endsOn) : "Not started",
                <Chip key="s" tone={tone}>{label}</Chip>,
                m.cardIssuedAt ? "Issued" : m.status === "approved" ? "To print" : m.status === "profile_pending" ? "Not yet" : "Temporary",
                <Link key="o" href={`/staff/applications?tab=all&id=${m.id}`} className="font-bold text-link hover:underline">
                  Open
                </Link>,
              ];
            })}
          />
        )}
        <p className="text-xs text-charcoal">Membership numbers are typed in from GymQ. This system never creates one.</p>
      </TableCard>
    </>
  );
}

const selectLabel = "text-[13px] font-semibold";

function AddMemberForm({ categories }: { categories: string[] }) {
  return (
    <ActionForm action={addMember} submitLabel="Add member" pendingLabel="Adding…">
      <p className="text-sm text-charcoal">
        They are emailed a link to fill in their membership profile. The application then shows under Applications for review and approval
        with their GymQ number, like an online sign-up.
      </p>
      <div className="flex flex-wrap gap-3.5">
        <Field label="Full name" id="fullName" required autoComplete="off" />
        <Field label="Phone" id="phone" type="tel" required autoComplete="off" />
        <Field label="Email" id="email" type="email" required autoComplete="off" className="basis-full" />
      </div>
      <div className="flex flex-wrap gap-3.5">
        <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1.5">
          <label htmlFor="category" className={selectLabel}>
            Category
          </label>
          <select id="category" name="category" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Choose a category
            </option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1.5">
          <label htmlFor="duration" className={selectLabel}>
            Length
          </label>
          <select id="duration" name="duration" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Choose a length
            </option>
            {(Object.keys(durationLabel) as (keyof typeof durationLabel)[]).map((d) => (
              <option key={d} value={d}>
                {durationLabel[d]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-3.5">
        <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1.5">
          <label htmlFor="method" className={selectLabel}>
            Payment
          </label>
          <select id="method" name="method" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              How did they pay?
            </option>
            <option value="pos">POS at the desk</option>
            <option value="cash">Cash</option>
            <option value="transfer">Bank transfer</option>
            <option value="none">No payment to record (already paid before)</option>
          </select>
        </div>
        <Field label="Receipt / transaction ref" id="receiptRef" autoComplete="off" hint="Needed when a payment is taken." />
        <Field
          label="Amount paid (₦)"
          id="amount"
          inputMode="numeric"
          autoComplete="off"
          hint="Leave empty to use the current rate."
        />
      </div>
    </ActionForm>
  );
}
