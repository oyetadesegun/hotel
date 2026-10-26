import { connection } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/db";

export const instant = false;

/** Staff now use the shared sign-in page. On first run (no staff yet) this goes to setup. */
export default async function StaffLoginPage() {
  await connection();
  redirect((await prisma.staffUser.count()) === 0 ? "/staff/setup" : "/login");
}
