import type { StaffRole } from "@/src/generated/prisma/client";

export const roleLabel: Record<StaffRole, string> = {
  admin: "Admin",
  staff: "Staff",
};

export const roleOrder: StaffRole[] = ["admin", "staff"];

/**
 * Who can do what. This is the table shown on /staff/users, and pages, the sidebar
 * and server actions all check it.
 */
export const permissions = {
  bookAndVerify: { label: "Desk bookings and verifying bookings", roles: ["admin", "staff"] },
  approveMembership: { label: "Approve members and issue cards", roles: ["admin", "staff"] },
  addMembers: { label: "Add a member at the desk", roles: ["admin"] },
  cancelPaidBooking: { label: "Cancel a paid booking", roles: ["admin"] },
  approveRefunds: { label: "Approve refunds", roles: ["admin"] },
  seeReports: { label: "See payments, reports and the audit trail", roles: ["admin"] },
  changeSetup: { label: "Change facilities, sessions, rates and rules", roles: ["admin"] },
  manageUsers: { label: "Manage staff users and system settings", roles: ["admin"] },
} satisfies Record<string, { label: string; roles: StaffRole[] }>;

export type Permission = keyof typeof permissions;

export function can(role: StaffRole, permission: Permission): boolean {
  return (permissions[permission].roles as StaffRole[]).includes(role);
}
