import { eq } from "drizzle-orm";
import { jsonError, requireParent } from "@/lib/auth-helpers";
import { childProfiles, parents, wordProgress } from "@/lib/db";
import { db } from "@/lib/db";

/** GET /api/me — current parent (creates the row on first call) + children. */
export async function GET() {
  const authed = await requireParent();
  if (!authed.ok) return jsonError(authed.status, authed.error);

  const children = await db
    .select({
      id: childProfiles.id,
      nickname: childProfiles.nickname,
      ageBand: childProfiles.ageBand,
      avatarId: childProfiles.avatarId,
    })
    .from(childProfiles)
    .where(eq(childProfiles.parentId, authed.parent.parentId));

  return Response.json({
    email: authed.parent.email,
    parentId: authed.parent.parentId,
    children,
  });
}

/**
 * DELETE /api/me — delete the parent account and ALL data
 * (children cascade). Child-safety requirement from the arch doc.
 */
export async function DELETE() {
  const authed = await requireParent();
  if (!authed.ok) return jsonError(authed.status, authed.error);

  // Delete word progress explicitly (defense in depth; cascades cover it).
  const children = await db
    .select({ id: childProfiles.id })
    .from(childProfiles)
    .where(eq(childProfiles.parentId, authed.parent.parentId));
  for (const child of children) {
    await db
      .delete(wordProgress)
      .where(eq(wordProgress.childId, child.id));
  }
  await db.delete(childProfiles).where(eq(childProfiles.parentId, authed.parent.parentId));
  await db.delete(parents).where(eq(parents.id, authed.parent.parentId));

  return Response.json({ deleted: true });
}
