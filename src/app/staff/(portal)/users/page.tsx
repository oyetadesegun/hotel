import type { Metadata } from "next";
import { prisma } from "@/src/lib/db";
import { requireStaffCan } from "@/src/lib/auth/session";
import { permissions, roleLabel, roleOrder } from "@/src/lib/auth/roles";
import { dateTime } from "@/src/lib/format";
import { ActionForm } from "@/src/components/ActionForm";
import { Button, Card, Chip, Field, Notice, inputClass } from "@/src/components/ui";
import { Col, Cols, PageTitle, TableCard } from "@/src/components/staff";
import { Table } from "@/src/components/table";
import { createStaffUser, resetStaffPassword, setStaffActive, setStaffRole } from "../../actions";

export const metadata: Metadata = { title: "Users and roles" };

export default async function UsersPage() {
  const me = await requireStaffCan("manageUsers");
  const canManage = true;
  const staff = await prisma.staffUser.findMany({ include: { account: true }, orderBy: [{ active: "desc" }, { fullName: "asc" }] });

  return (
    <>
      <PageTitle title="Users and roles" sample={false} sub="Staff who can sign in, and what each role can do." />
      <Cols>
        <Col grow={3} basis={600}>
          <TableCard>
            <Table
              heads={["Name", "Email", "Role", "Last sign-in", "Status", ...(canManage ? [""] : [])]}
              rows={staff.map((s) => [
                <b key="n">
                  {s.fullName}
                  {s.id === me.accountId && <span className="font-normal text-charcoal"> (you)</span>}
                </b>,
                s.account.email,
                s.id === me.accountId ? (
                  roleLabel[s.role]
                ) : (
                  <form key="r" action={setStaffRole} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={s.id} />
                    <select name="role" defaultValue={s.role} aria-label={`Role for ${s.fullName}`} className={inputClass + " h-9 w-auto py-0 text-sm"}>
                      {roleOrder.map((r) => (
                        <option key={r} value={r}>
                          {roleLabel[r]}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" variant="secondary" size="sm">
                      Change
                    </Button>
                  </form>
                ),
                s.account.mustChangePassword && s.account.lastSignInAt == null ? "Not yet" : dateTime(s.account.lastSignInAt),
                <Chip key="s" tone={s.active ? "ok" : "neutral"}>
                  {s.active ? (s.account.mustChangePassword ? "Active, temporary password" : "Active") : "Disabled"}
                </Chip>,
                ...(canManage
                  ? [
                      s.id === me.accountId ? (
                        ""
                      ) : (
                        <div key="a" className="flex flex-col items-start gap-2">
                          <form action={setStaffActive}>
                            <input type="hidden" name="id" value={s.id} />
                            <input type="hidden" name="active" value={String(!s.active)} />
                            <Button type="submit" variant="secondary" size="sm">
                              {s.active ? "Disable" : "Enable"}
                            </Button>
                          </form>
                          {s.active && (
                            <ActionForm action={resetStaffPassword} submitLabel="Reset password" variant="secondary" full={false} className="max-w-56 items-start [&_button]:h-9 [&_button]:text-sm">
                              <input type="hidden" name="id" value={s.id} />
                            </ActionForm>
                          )}
                        </div>
                      ),
                    ]
                  : []),
              ])}
            />
          </TableCard>
          <TableCard>
            <h2 className="text-base font-bold">What each role can do</h2>
            <Table
              heads={["Action", ...roleOrder.map((r) => roleLabel[r])]}
              rows={Object.values(permissions).map((p) => [
                p.label,
                ...roleOrder.map((r) => ((p.roles as string[]).includes(r) ? "Yes" : "-")),
              ])}
            />
            <p className="text-xs text-charcoal">The system enforces this table. You cannot change your own role, so there is always at least one admin.</p>
          </TableCard>
        </Col>
        <Col basis={300}>
          <Card as="aside">
            <h2 className="text-base font-bold">Add a staff user</h2>
            {canManage ? (
              <ActionForm action={createStaffUser} submitLabel="Add user" pendingLabel="Adding…">
                <Field label="Full name" id="fullName" required className="basis-full" />
                <Field label="Work email" id="email" type="email" required className="basis-full" />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="role" className="text-[13px] font-semibold">
                    Role
                  </label>
                  <select id="role" name="role" required defaultValue="" className={inputClass}>
                    <option value="" disabled>
                      Choose a role
                    </option>
                    {roleOrder.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel[r]}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs leading-relaxed text-charcoal">
                  They get a temporary password to sign in with, shown to you once, and must choose their own on first sign-in.
                </p>
              </ActionForm>
            ) : (
              <Notice>Only an admin can add or change staff users.</Notice>
            )}
          </Card>
        </Col>
      </Cols>
    </>
  );
}
