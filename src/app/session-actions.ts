"use server";

import { prisma } from "@/src/lib/db";
import { getSignedIn } from "@/src/lib/auth/session";
import { activeMembershipOf } from "@/src/lib/booking-engine";

export type CurrentUser = {
  kind: "member" | "staff";
  name: string;
  initials: string;
  /** Passport photo from the membership application, when there is one. */
  photoUrl: string | null;
  /** Set when the member has an active membership: they can book without typing it. */
  memberNumber: string | null;
  home: { href: string; label: string };
};

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("") || "?";

/** Who is signed in, for headers and the booking popup. Pages stay cached; this runs in the browser after load. */
export async function currentUser(): Promise<CurrentUser | null> {
  const me = await getSignedIn();
  if (!me) return null;
  if (me.kind === "staff" && me.staff) {
    return {
      kind: "staff",
      name: me.staff.fullName,
      initials: initialsOf(me.staff.fullName),
      photoUrl: null,
      memberNumber: null,
      home: { href: "/staff", label: "Staff portal" },
    };
  }
  if (!me.customerId) return null;
  const [customer, active, withPhoto] = await Promise.all([
    prisma.customer.findUnique({ where: { id: me.customerId }, select: { fullName: true } }),
    activeMembershipOf(me.customerId),
    prisma.membership.findFirst({
      where: { customerId: me.customerId, photoPath: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
  ]);
  const name = customer?.fullName ?? me.email;
  return {
    kind: "member",
    name,
    initials: initialsOf(name),
    photoUrl: withPhoto ? `/api/membership-photo/${withPhoto.id}` : null,
    memberNumber: active?.gymqNumber ?? null,
    home: { href: "/membership/me", label: "My membership" },
  };
}
