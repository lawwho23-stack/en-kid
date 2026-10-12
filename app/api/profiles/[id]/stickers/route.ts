import { eq } from "drizzle-orm";
import { jsonError, requireChild, requireParent } from "@/lib/auth-helpers";
import { stickers } from "@/lib/db";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/profiles/[id]/stickers — sticker book. */
export async function GET(_request: Request, ctx: Ctx) {
  const authed = await requireParent();
  if (!authed.ok) return jsonError(authed.status, authed.error);
  const { id } = await ctx.params;

  const child = await requireChild(authed.parent.parentId, id);
  if (!child) return jsonError(404, "Child profile not found.");

  const rows = await db
    .select()
    .from(stickers)
    .where(eq(stickers.childId, id));
  return Response.json({ stickers: rows });
}
