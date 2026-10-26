import type { Metadata } from "next";
import { prisma } from "@/src/lib/db";
import { requireStaffCan } from "@/src/lib/auth/session";
import { dateTime } from "@/src/lib/format";
import { Card, Chip, KV, type Tone } from "@/src/components/ui";
import { PageTitle } from "@/src/components/staff";

export const metadata: Metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  await requireStaffCan("manageUsers");
  const [lastPayment, lastGymq, lastEmail] = await Promise.all([
    prisma.payment.findFirst({ where: { method: "online" }, orderBy: { createdAt: "desc" } }),
    prisma.auditLog.findFirst({ where: { action: "Application approved" }, orderBy: { at: "desc" } }),
    prisma.auditLog.findFirst({ where: { action: "Email sent" }, orderBy: { at: "desc" } }),
  ]);
  const paymentMode = process.env.PAYMENT_MODE === "test" ? "test" : process.env.REDPAY_SECRET_KEY ? "live" : "off";
  const email = Boolean(process.env.EMAIL_API_KEY);
  const opera = Boolean(process.env.OPERA_BASE_URL);

  const items: { name: string; text: string; status: string; tone: Tone; rows: [string, string][] }[] = [
    {
      name: "Payment gateway (RedPay)",
      text: "Takes online card payments and reports the result back.",
      status: paymentMode === "live" ? "Connected" : paymentMode === "test" ? "Test mode" : "Not connected",
      tone: paymentMode === "live" ? "ok" : "warn",
      rows: [
        ["Mode", paymentMode === "test" ? "Test: no real money moves" : paymentMode === "live" ? "Live" : "Off"],
        ["Last online payment", dateTime(lastPayment?.createdAt)],
      ],
    },
    {
      name: "Email",
      text: "Sends payment receipts, profile links, approvals and staff notices.",
      status: email ? "Connected" : "Not connected",
      tone: email ? "ok" : "warn",
      rows: [
        ["Sender", process.env.EMAIL_FROM ?? "Not set"],
        ["Last email", dateTime(lastEmail?.at)],
        ["Without a provider", "Emails print in the server terminal"],
      ],
    },
    {
      name: "GymQ",
      text: "Source of membership numbers. Typed in by the Recreation Manager when approving.",
      status: "Manual",
      tone: "neutral",
      rows: [
        ["Method", "Manual entry"],
        ["Numbers created here", "Never"],
        ["Last entry", dateTime(lastGymq?.at)],
      ],
    },
    {
      name: "Hotel system (OPERA)",
      text: "Checks that a resident guest is in-house. Read only.",
      status: opera ? "Configured" : "Waiting for approval",
      tone: opera ? "ok" : "warn",
      rows: [
        ["Method", "Currentlink or guest Wi-Fi sign-in, to be confirmed with IT"],
        ["Fallback", "Manual guest check"],
      ],
    },
  ];

  return (
    <>
      <PageTitle title="Integrations" sub="Outside systems this one talks to." />
      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((i) => (
          <Card key={i.name}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[17px] font-bold">{i.name}</h2>
              <Chip tone={i.tone}>{i.status}</Chip>
            </div>
            <span className="text-[13px] leading-relaxed text-charcoal">{i.text}</span>
            <KV rows={i.rows} />
          </Card>
        ))}
      </div>
    </>
  );
}
