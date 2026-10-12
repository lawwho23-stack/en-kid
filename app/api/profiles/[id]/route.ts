import { eq } from "drizzle-orm";
import { jsonError, requireChild, requireParent } from "@/lib/auth-helpers";
import { childProfiles } from "@/lib/db";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/profiles/[id] — update nickname or age band. */
export async function PATCH(request: Request, ctx: Ctx) {
  const authed = await requireParent();
  if (!authed.ok) return jsonError(authed.status, authed.error);
  const { id } = await ctx.params;

  const child = await requireChild(authed.parent.parentId, id);
  if (!child) return jsonError(404, "Child profile not found.");

  const body = (await request.json().catch(() => null)) as {
    nickname?: unknown;
    ageBand?: unknown;
    avatarId?: unknown;
  } | null;

  const patch: Partial<typeof childProfiles.$inferInsert> = {};
  if (typeof body?.nickname === "string" && body.nickname.trim()) {
    patch.nickname = body.nickname.trim().slice(0, 24);
  }
  if (
    body?.ageBand === "1-2" ||
    body?.ageBand === "3-4" ||
    body?.ageBand === "5"
  ) {
    patch.ageBand = body.ageBand;
  }
  if (typeof body?.avatarId === "string") {
    patch.avatarId = body.avatarId.slice(0, 64);
  }
  if (Object.keys(patch).length === 0) {
    return jsonError(400, "Nothing to update.");
  }

  const updated = await db
    .update(childProfiles)
    .set(patch)
    .where(eq(childProfiles.id, id))
    .returning();
  return Response.json({ child: updated[0] });
}

/** DELETE /api/profiles/[id] — delete child and all their data. */
export async function DELETE(_request: Request, ctx: Ctx) {
  const authed = await requireParent();
  if (!authed.ok) return jsonError(authed.status, authed.error);
  const { id } = await ctx.params;

  const child = await requireChild(authed.parent.parentId, id);
  if (!child) return jsonError(404, "Child profile not found.");

  await db.delete(childProfiles).where(eq(childProfiles.id, id));
  return Response.json({ deleted: true });
}
