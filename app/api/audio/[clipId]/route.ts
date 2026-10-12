import { eq } from "drizzle-orm";
import { audioClips } from "@/lib/db";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ clipId: string }> };

/**
 * GET /api/audio/[clipId] — serve a voice/song clip from Neon.
 * Clip ids are content-hashed on write, so responses are immutable:
 * browsers, the Vercel edge, and the service worker all cache them.
 * Unknown ids 404 and the client falls back to synth placeholder audio.
 */
export async function GET(_request: Request, ctx: Ctx) {
  const { clipId } = await ctx.params;

  const rows = await db
    .select({
      bytes: audioClips.bytes,
      contentType: audioClips.contentType,
    })
    .from(audioClips)
    .where(eq(audioClips.clipId, clipId))
    .limit(1);

  const clip = rows[0];
  if (!clip) {
    return Response.json({ error: "Clip not found." }, { status: 404 });
  }

  return new Response(Buffer.from(clip.bytes), {
    headers: {
      "content-type": clip.contentType ?? "audio/mpeg",
      // Immutable: a changed clip gets a new row, never a changed body.
      "cache-control":
        "public, max-age=31536000, s-maxage=31536000, immutable",
    },
  });
}
