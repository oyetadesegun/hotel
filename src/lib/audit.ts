import "server-only";

import { prisma } from "@/src/lib/db";
import type { Prisma } from "@/src/generated/prisma/client";

/**
 * Adds a line to the audit trail (append only, enforced by the database).
 * `actor` is a staff user id, "system", or "member:<customer id>".
 */
export async function audit(actor: string, action: string, item?: string | null, details?: Prisma.InputJsonValue) {
  await prisma.auditLog.create({ data: { actor, action, item: item ?? null, details } });
}
