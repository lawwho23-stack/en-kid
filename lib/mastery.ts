/**
 * Pure game logic (unit-tested). No React, no audio, no network.
 * Rules from docs/architecture.md section 8.1.
 */

export type MasteryMap = Record<string, number>;

export function pickNextWord(
  lessonWords: string[],
  mastery: MasteryMap,
  lastWordId: string | null,
): string {
  // Quietly re-serve weaker words: lowest mastery first.
  const sorted = [...lessonWords].sort(
    (a, b) => (mastery[a] ?? 0) - (mastery[b] ?? 0),
  );
  const weakest = sorted.filter((w) => (mastery[w] ?? 0) === (mastery[sorted[0]] ?? 0));
  const options = weakest.filter((w) => w !== lastWordId);
  const pool = options.length > 0 ? options : weakest;
  return pool[Math.floor(Math.random() * pool.length)];
}

export type Choice = { wordId: string; isCorrect: boolean };

/**
 * Build 2–3 picture cards. Correct slot randomized, never the same slot
 * more than twice in a row (caller passes lastSlots history).
 * Distractors come from the same pool; similar-looking pairs unlock later
 * (mastery >= 2), simple clearly-different ones first.
 */
export function buildChoices(
  wordId: string,
  poolWordIds: string[],
  count: number,
  lastSlots: number[],
  mastery: MasteryMap,
  similarPairs: Record<string, string[]> = {},
): { choices: Choice[]; slot: number } {
  const level = mastery[wordId] ?? 0;
  let distractors = poolWordIds.filter((w) => w !== wordId);
  if (level < 2) {
    const similar = new Set(similarPairs[wordId] ?? []);
    distractors = distractors.filter((w) => !similar.has(w));
  }
  // Shuffle distractors and take what we need.
  const shuffled = [...distractors].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, Math.max(0, count - 1));

  // Avoid a third repeat of the same slot.
  let slot = Math.floor(Math.random() * (picked.length + 1));
  const n = lastSlots.length;
  if (n >= 2 && lastSlots[n - 1] === lastSlots[n - 2] && slot === lastSlots[n - 1]) {
    slot = (slot + 1) % (picked.length + 1);
  }

  const choices: Choice[] = [];
  let di = 0;
  for (let i = 0; i < picked.length + 1; i++) {
    if (i === slot) choices.push({ wordId, isCorrect: true });
    else choices.push({ wordId: picked[di++], isCorrect: false });
  }
  return { choices, slot };
}

export type CelebrationTier = 1 | 2 | 3;

/** Tier by streak; lesson completion always escalates to the big song. */
export function celebrationTier(
  streak: number,
  lessonDone: boolean,
  mediumStreak = 3,
): CelebrationTier {
  if (lessonDone) return 3;
  if (streak > 0 && streak % mediumStreak === 0) return 2;
  return 1;
}

/** Soft mastery 0..3: +1 on correct, -1 after repeated misses. */
export function nextMastery(current: number, correct: boolean): number {
  return Math.max(0, Math.min(3, current + (correct ? 1 : -1)));
}

export function isLessonComplete(wordsDone: number, lessonSize: number): boolean {
  return wordsDone >= lessonSize;
}
