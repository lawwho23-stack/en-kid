import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { childProfiles, parents } from "@/lib/db";
import { db } from "@/lib/db";

export type AuthedParent = {
  authUserId: string;
  email: string | null;
  parentId: string;
};

/** Require a signed-in parent; create the `parents` row on first call. */
export async function requireParent(): Promise<
  { ok: true; parent: AuthedParent } | { ok: false; status: number; error: string }
> {
  const session = await auth();
  const authUserId =
    session?.user?.id ??
    (session?.user?.email
      ? `email:${session.user.email.toLowerCase()}`
      : null);
  if (!session?.user || !authUserId) {
    return { ok: false, status: 401, error: "Sign in required." };
  }

  const existing = await db
    .select()
    .from(parents)
    .where(eq(parents.authUserId, authUserId))
    .limit(1);
  if (existing[0]) {
    return {
      ok: true,
      parent: {
        authUserId,
        email: session.user.email ?? null,
        parentId: existing[0].id,
      },
    };
  }

  const inserted = await db
    .insert(parents)
    .values({ authUserId })
    .returning({ id: parents.id });
  return {
    ok: true,
    parent: {
      authUserId,
      email: session.user.email ?? null,
      parentId: inserted[0].id,
    },
  };
}

/** Verify a child profile belongs to the parent. Returns the child row. */
export async function requireChild(parentId: string, childId: string) {
  const rows = await db
    .select()
    .from(childProfiles)
    .where(eq(childProfiles.id, childId))
    .limit(1);
  const child = rows[0];
  if (!child || child.parentId !== parentId) {
    return null;
  }
  return child;
}

export function jsonError(status: number, error: string) {
  return Response.json({ error }, { status });
}
