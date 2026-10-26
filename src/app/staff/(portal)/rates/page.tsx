import type { Metadata } from "next";
import { prisma } from "@/src/lib/db";
import { requireStaff } from "@/src/lib/auth/session";
import { can } from "@/src/lib/auth/roles";
import { naira } from "@/src/lib/format";
import { currentRates } from "@/src/lib/membership";
import { Card, KV, Notice } from "@/src/components/ui";
import { Col, Cols, PageTitle, TableCard } from "@/src/components/staff";
import { Table } from "@/src/components/table";
import { BookingRulesForm, MembershipRatesForm } from "@/src/components/RateForms";
import { DialogButton } from "@/src/components/DialogButton";

export const metadata: Metadata = { title: "Rates and rules" };

const settingLabel: Record<string, (v: number) => string> = {
  sessions_per_24h: (v) => `${v} sessions per person, per facility, in 24 hours`,
  hold_unpaid_hours: (v) => `Unpaid reservations are held for ${v} hours`,
  staff_book_ahead_days: (v) => `Staff can book ${v} days ahead`,
  application_form_fee_kobo: (v) => `Printed application form: ${naira(v / 100)}`,
};

const longDate = (d: Date) => d.toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });

export default async function RatesPage() {
  const me = await requireStaff();
  const canEdit = can(me.staff.role, "changeSetup");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  const [rates, settings, latest, upcoming] = await Promise.all([
    currentRates(),
    prisma.setting.findMany({ orderBy: { key: "asc" } }),
    prisma.membershipRate.findFirst({ where: { effectiveFrom: { lte: new Date() } }, orderBy: { effectiveFrom: "desc" } }),
    prisma.membershipRate.findMany({
      where: { effectiveFrom: { gt: new Date() } },
      distinct: ["effectiveFrom"],
      select: { effectiveFrom: true },
      orderBy: { effectiveFrom: "asc" },
    }),
  ]);
  const price = (v: number | null) => (v == null ? "Agreed per company" : naira(v));
  const values = Object.fromEntries(settings.map((s) => [s.key, typeof s.value === "number" ? s.value : undefined]));

  return (
    <>
      <PageTitle title="Membership rates and booking rules" sub="The prices and limits the system uses today." />
      {upcoming.length > 0 && (
        <Notice tone="info">
          New rates are set to start on {upcoming.map((u) => longDate(u.effectiveFrom)).join(", ")}. Until then the rates below apply.
        </Notice>
      )}
      <Cols>
        <Col grow={2} basis={600}>
          <TableCard>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold">
                Membership rates
                {latest && <span className="font-normal text-charcoal">, effective {longDate(latest.effectiveFrom)}</span>}
              </h2>
              {canEdit && (
                <DialogButton label="Set new rates" title="Set new membership rates">
                  <MembershipRatesForm current={rates} today={today} />
                </DialogButton>
              )}
            </div>
            <Table
              heads={["Category", "Annual", "6 months", "3 months", "1 month"]}
              rows={rates.map((r) => [<b key="c">{r.category}</b>, price(r.annual), price(r.m6), price(r.m3), price(r.m1)])}
            />
          </TableCard>
        </Col>
        <Col basis={320}>
          <Card as="aside">
            <h2 className="text-base font-bold">Booking rules</h2>
            {canEdit ? (
              <BookingRulesForm values={values} />
            ) : (
              <KV
                rows={settings.map((s) => [
                  s.key.replaceAll("_", " "),
                  settingLabel[s.key] && typeof s.value === "number" ? settingLabel[s.key](s.value) : JSON.stringify(s.value),
                ])}
              />
            )}
            <Notice>A paid, confirmed booking can never be overridden. This is built in and is not a setting.</Notice>
          </Card>
        </Col>
      </Cols>
      {!canEdit && <Notice>Only an admin can change rates and rules.</Notice>}
    </>
  );
}
