import { eq } from "drizzle-orm";
import { jsonError, requireParent } from "@/lib/auth-helpers";
import { childProfiles, childState } from "@/lib/db";
import { db } from "@/lib/db";

const AGE_BANDS = ["1-2", "3-4", "5"] as const;

/** GET /api/profiles — list the parent's child profiles. */
export async function GET() {
  const authed = await requireParent();
  if (!authed.ok) return jsonError(authed.status, authed.error);

  const children = await db
    .select()
    .from(childProfiles)
    .where(eq(childProfiles.parentId, authed.parent.parentId));
  return Response.json({ children });
}

/** POST /api/profiles — create a child profile (nickname + age band only). */
export async function POST(request: Request) {
  const authed = await requireParent();
  if (!authed.ok) return jsonError(authed.status, authed.error);

  const body = (await request.json().catch(() => null)) as {
    nickname?: unknown;
    ageBand?: unknown;
    avatarId?: unknown;
  } | null;

  const nickname =
    typeof body?.nickname === "string" ? body.nickname.trim().slice(0, 24) : "";
  const ageBand = body?.ageBand;
  if (!nickname) return jsonError(400, "Nickname is required.");
  if (ageBand !== "1-2" && ageBand !== "3-4" && ageBand !== "5") {
    return jsonError(400, `ageBand must be one of ${AGE_BANDS.join(", ")}.`);
  }
  const avatarId =
    typeof body?.avatarId === "string" ? body.avatarId.slice(0, 64) : null;

  const inserted = await db
    .insert(childProfiles)
    .values({
      parentId: authed.parent.parentId,
      nickname,
      ageBand,
      avatarId,
    })
    .returning();
  const child = inserted[0];

  await db
    .insert(childState)
    .values({ childId: child.id })
    .onConflictDoNothing();

  return Response.json({ child }, { status: 201 });
}
