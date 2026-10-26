import { redirect } from "next/navigation";
import { StaffMobileBar, StaffSidebar } from "@/src/components/StaffNav";
import { requireStaff } from "@/src/lib/auth/session";
import { roleLabel } from "@/src/lib/auth/roles";

// Every staff page depends on who is signed in, so these pages wait for the session.
export const instant = false;

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff();
  if (me.mustChangePassword) redirect("/staff/password");
  const user = { name: me.staff.fullName, role: me.staff.role, roleLabel: roleLabel[me.staff.role] };

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <StaffMobileBar user={user} />
      <StaffSidebar user={user} />
      <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 py-6 sm:px-8 sm:py-7">{children}</main>
    </div>
  );
}
