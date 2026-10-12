import { sql } from "drizzle-orm";
import { jsonError, requireChild, requireParent } from "@/lib/auth-helpers";
import { playSessions, stickers } from "@/lib/db";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

type ProgressEvent = {
  word_id?: unknown;
  correct?: unknown;
  attempts?: unknown;
  hint_used?: unknown;
};

/**
 * POST /api/profiles/[id]/progress — batched progress events.
 * The client sends these at natural pauses (end of activity), never per tap.
 * Body: { events: ProgressEvent[], stars?: number, session?: { startedAt, durationSec, worldId }, stickerIds?: string[] }
 */
export async function POST(request: Request, ctx: Ctx) {
  const authed = await requireParent();
  if (!authed.ok) return jsonError(authed.status, authed.error);
  const { id } = await ctx.params;

  const child = await requireChild(authed.parent.parentId, id);
  if (!child) return jsonError(404, "Child profile not found.");

  const body = (await request.json().catch(() => null)) as {
    events?: unknown;
    stars?: unknown;
    session?: unknown;
    stickerIds?: unknown;
  } | null;
  const events = Array.isArray(body?.events) ? (body.events as ProgressEvent[]) : [];

  // Apply each event with an atomic upsert (mastery stays 0..3).
  // attempts counts total taps: wrong taps = attempts-1 on success, attempts on failure.
  for (const raw of events.slice(0, 200)) {
    if (typeof raw?.word_id !== "string" || !raw.word_id) continue;
    const wordId = raw.word_id.slice(0, 64);
    const correct = raw.correct === true;
    const attempts =
      typeof raw.attempts === "number" && Number.isFinite(raw.attempts)
        ? Math.max(1, Math.min(50, Math.floor(raw.attempts)))
        : 1;
    const wrongTaps = correct ? attempts - 1 : attempts;
    await db.execute(sql`
      INSERT INTO word_progress (child_id, word_id, mastery, correct_count, miss_count, last_seen_at)
      VALUES (${id}, ${wordId}, ${correct ? 1 : 0}, ${correct ? 1 : 0}, ${wrongTaps}, now())
      ON CONFLICT (child_id, word_id) DO UPDATE SET
        mastery = LEAST(3, GREATEST(0, word_progress.mastery + ${correct ? 1 : -1})),
        correct_count = word_progress.correct_count + ${correct ? 1 : 0},
        miss_count = word_progress.miss_count + ${wrongTaps},
        last_seen_at = now()
    `);
  }

  const stars =
    typeof body?.stars === "number" && Number.isFinite(body.stars)
      ? Math.max(0, Math.min(1000, Math.floor(body.stars)))
      : 0;
  if (stars > 0) {
    await db.execute(sql`
      INSERT INTO child_state (child_id, total_stars, updated_at)
      VALUES (${id}, ${stars}, now())
      ON CONFLICT (child_id) DO UPDATE SET
        total_stars = child_state.total_stars + ${stars},
        updated_at = now()
    `);
  }

  const stickerIds = Array.isArray(body?.stickerIds)
    ? (body.stickerIds as unknown[]).filter((s): s is string => typeof s === "string").slice(0, 50)
    : [];
  for (const stickerId of stickerIds) {
    await db
      .insert(stickers)
      .values({ childId: id, stickerId: stickerId.slice(0, 64) })
      .onConflictDoNothing();
  }

  const session = body?.session as
    | { startedAt?: unknown; durationSec?: unknown; worldId?: unknown }
    | undefined;
  if (session && typeof session.startedAt === "string") {
    const startedAt = new Date(session.startedAt);
    if (!Number.isNaN(startedAt.getTime())) {
      await db.insert(playSessions).values({
        childId: id,
        startedAt,
        durationSec:
          typeof session.durationSec === "number"
            ? Math.max(0, Math.floor(session.durationSec))
            : null,
        worldId:
          typeof session.worldId === "string"
            ? session.worldId.slice(0, 64)
            : null,
      });
    }
  }

  return Response.json({ saved: true, events: Math.min(events.length, 200) });
}
