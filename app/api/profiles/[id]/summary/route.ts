import { desc, eq, sql } from "drizzle-orm";
import { jsonError, requireChild, requireParent } from "@/lib/auth-helpers";
import { childState, playSessions, stickers, wordProgress } from "@/lib/db";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/profiles/[id]/summary — parent dashboard data. */
export async function GET(_request: Request, ctx: Ctx) {
  const authed = await requireParent();
  if (!authed.ok) return jsonError(authed.status, authed.error);
  const { id } = await ctx.params;

  const child = await requireChild(authed.parent.parentId, id);
  if (!child) return jsonError(404, "Child profile not found.");

  const [stateRows, words, stickerRows, recentSessions, totals] =
    await Promise.all([
      db.select().from(childState).where(eq(childState.childId, id)).limit(1),
      db.select().from(wordProgress).where(eq(wordProgress.childId, id)),
      db.select().from(stickers).where(eq(stickers.childId, id)),
      db
        .select()
        .from(playSessions)
        .where(eq(playSessions.childId, id))
        .orderBy(desc(playSessions.startedAt))
        .limit(10),
      db.execute(sql`
        SELECT COALESCE(SUM(duration_sec), 0) AS total_seconds,
               COUNT(*) AS session_count
        FROM play_sessions WHERE child_id = ${id}
      `),
    ]);

  const mastered = words.filter((w) => (w.mastery ?? 0) >= 2).length;
  const total = totals.rows[0] as unknown as {
    total_seconds: string;
    session_count: string;
  };

  return Response.json({
    child: {
      id: child.id,
      nickname: child.nickname,
      ageBand: child.ageBand,
    },
    state: stateRows[0] ?? null,
    wordsLearned: mastered,
    wordsInProgress: words.length - mastered,
    stickerCount: stickerRows.length,
    totalPlaySeconds: Number(total?.total_seconds ?? 0),
    sessionCount: Number(total?.session_count ?? 0),
    recentSessions,
  });
}
