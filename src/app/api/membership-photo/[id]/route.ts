import { prisma } from "@/src/lib/db";
import { getSignedIn } from "@/src/lib/auth/session";
import { readPhoto } from "@/src/lib/storage";

/** Passport photo for a membership. Staff can see any; a member only their own. */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const me = await getSignedIn();
  if (!me) return new Response("Not signed in", { status: 401 });

  const m = await prisma.membership.findUnique({ where: { id }, select: { photoPath: true, customerId: true } });
  const allowed = m && (me.kind === "staff" || me.customerId === m.customerId);
  if (!allowed || !m.photoPath) return new Response("Not found", { status: 404 });

  const photo = await readPhoto(m.photoPath);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: { "Content-Type": photo.type, "Cache-Control": "private, max-age=300" },
  });
}
