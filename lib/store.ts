import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ProgressEvent = {
  word_id: string;
  correct: boolean;
  attempts: number;
  hint_used: boolean;
};

type GameStore = {
  activeChildId: string | null;
  sessionStars: number;
  sessionStickers: string[];
  queue: ProgressEvent[];
  sessionStartedAt: string | null;
  sessionWorldId: string | null;
  setActiveChild: (id: string | null) => void;
  beginSession: (worldId: string) => void;
  recordEvent: (e: ProgressEvent) => void;
  addStars: (n: number) => void;
  addSticker: (id: string) => void;
  /** Send queued events to the API (batched, never blocks play). */
  flush: () => Promise<boolean>;
  resetSession: () => void;
};

const EMPTY = {
  sessionStars: 0,
  sessionStickers: [] as string[],
  queue: [] as ProgressEvent[],
  sessionStartedAt: null as string | null,
  sessionWorldId: null as string | null,
};

export const useGame = create<GameStore>()(
  persist(
    (set, get) => ({
      activeChildId: null,
      ...EMPTY,
      setActiveChild: (id) => set({ activeChildId: id }),
      beginSession: (worldId) =>
        set({
          ...EMPTY,
          sessionStartedAt: new Date().toISOString(),
          sessionWorldId: worldId,
        }),
      recordEvent: (e) => set((s) => ({ queue: [...s.queue, e] })),
      addStars: (n) => set((s) => ({ sessionStars: s.sessionStars + n })),
      addSticker: (id) =>
        set((s) =>
          s.sessionStickers.includes(id)
            ? s
            : { sessionStickers: [...s.sessionStickers, id] },
        ),
      flush: async () => {
        const { activeChildId, queue, sessionStars, sessionStickers } = get();
        if (!activeChildId || (queue.length === 0 && sessionStars === 0)) {
          return true;
        }
        try {
          const startedAt = get().sessionStartedAt;
          const worldId = get().sessionWorldId;
          const res = await fetch(`/api/profiles/${activeChildId}/progress`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              events: queue,
              stars: sessionStars,
              stickerIds: sessionStickers,
              session: startedAt
                ? {
                    startedAt,
                    durationSec: Math.round(
                      (Date.now() - new Date(startedAt).getTime()) / 1000,
                    ),
                    worldId,
                  }
                : undefined,
            }),
          });
          if (!res.ok) return false;
          set({ queue: [], sessionStars: 0, sessionStickers: [] });
          return true;
        } catch {
          return false; // keep queue; retry at the next pause. Play never blocks.
        }
      },
      resetSession: () => set({ ...EMPTY }),
    }),
    { name: "kids-english-game", partialize: (s) => ({ activeChildId: s.activeChildId }) },
  ),
);
