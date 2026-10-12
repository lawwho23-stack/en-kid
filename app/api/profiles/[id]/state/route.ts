import { eq } from "drizzle-orm";
import { jsonError, requireChild, requireParent } from "@/lib/auth-helpers";
import { childState } from "@/lib/db";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/profiles/[id]/state — stars, unlocked worlds, outfits. */
export async function GET(_request: Request, ctx: Ctx) {
  const authed = await requireParent();
  if (!authed.ok) return jsonError(authed.status, authed.error);
  const { id } = await ctx.params;

  const child = await requireChild(authed.parent.parentId, id);
  if (!child) return jsonError(404, "Child profile not found.");

  const rows = await db
    .select()
    .from(childState)
    .where(eq(childState.childId, id))
    .limit(1);
  if (!rows[0]) {
    const inserted = await db
      .insert(childState)
      .values({ childId: id })
      .returning();
    return Response.json({ state: inserted[0] });
  }
  return Response.json({ state: rows[0] });
}
