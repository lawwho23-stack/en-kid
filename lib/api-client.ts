/** Typed client for the /api routes (docs/architecture.md section 12). */

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status}).`);
  }
  return (await res.json()) as T;
}

export type ChildProfile = {
  id: string;
  nickname: string;
  ageBand: "1-2" | "3-4" | "5";
  avatarId: string | null;
};

export const api = {
  me: () =>
    req<{ email: string | null; parentId: string; children: ChildProfile[] }>(
      "/api/me",
    ),
  listProfiles: () => req<{ children: ChildProfile[] }>("/api/profiles"),
  createProfile: (nickname: string, ageBand: ChildProfile["ageBand"]) =>
    req<{ child: ChildProfile }>("/api/profiles", {
      method: "POST",
      body: JSON.stringify({ nickname, ageBand }),
    }),
  deleteProfile: (id: string) =>
    req<{ deleted: boolean }>(`/api/profiles/${id}`, { method: "DELETE" }),
  summary: (id: string) =>
    req<{
      child: ChildProfile;
      state: {
        totalStars: number;
        unlockedWorlds: string[];
        outfitIds: string[];
      } | null;
      wordsLearned: number;
      wordsInProgress: number;
      stickerCount: number;
      totalPlaySeconds: number;
      sessionCount: number;
    }>(`/api/profiles/${id}/summary`),
  deleteAccount: () => req<{ deleted: boolean }>("/api/me", { method: "DELETE" }),
};
