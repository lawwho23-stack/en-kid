import { describe, expect, it } from "vitest";
import {
  buildChoices,
  celebrationTier,
  isLessonComplete,
  nextMastery,
  pickNextWord,
} from "@/lib/mastery";

describe("pickNextWord", () => {
  it("serves the weakest word first", () => {
    const words = ["cat", "dog", "cow"];
    const mastery = { cat: 2, dog: 0, cow: 1 };
    for (let i = 0; i < 20; i++) {
      expect(pickNextWord(words, mastery, null)).toBe("dog");
    }
  });

  it("avoids repeating the last word when alternatives exist", () => {
    const words = ["cat", "dog"];
    for (let i = 0; i < 20; i++) {
      expect(pickNextWord(words, {}, "cat")).toBe("dog");
    }
  });
});

describe("buildChoices", () => {
  const pool = ["cat", "dog", "cow", "duck"];

  it("builds the right number of cards with exactly one correct", () => {
    for (let i = 0; i < 30; i++) {
      const { choices } = buildChoices("cat", pool, 3, [], {});
      expect(choices).toHaveLength(3);
      expect(choices.filter((c) => c.isCorrect)).toHaveLength(1);
      expect(choices.find((c) => c.isCorrect)?.wordId).toBe("cat");
    }
  });

  it("never uses the same slot three times in a row", () => {
    const slots: number[] = [1, 1];
    for (let i = 0; i < 30; i++) {
      const { slot } = buildChoices("cat", pool, 2, slots, {});
      expect(slot === 1 && slots.at(-1) === 1 && slots.at(-2) === 1).toBe(false);
      slots.push(slot);
    }
  });

  it("unlocks similar distractors only at high mastery", () => {
    const similar = { cat: ["cow"] };
    const easy = buildChoices("cat", pool, 4, [], {}, similar);
    expect(easy.choices.map((c) => c.wordId)).not.toContain("cow");
    const hard = buildChoices("cat", pool, 4, [], { cat: 3 }, similar);
    expect(hard.choices.map((c) => c.wordId)).toContain("cow");
  });
});

describe("celebrationTier", () => {
  it("tier 1 for normal correct answers", () => {
    expect(celebrationTier(1, false)).toBe(1);
    expect(celebrationTier(2, false)).toBe(1);
  });
  it("tier 2 every 3rd streak", () => {
    expect(celebrationTier(3, false)).toBe(2);
    expect(celebrationTier(6, false)).toBe(2);
  });
  it("tier 3 when the lesson is complete", () => {
    expect(celebrationTier(1, true)).toBe(3);
  });
});

describe("mastery", () => {
  it("stays within 0..3", () => {
    expect(nextMastery(3, true)).toBe(3);
    expect(nextMastery(0, false)).toBe(0);
    expect(nextMastery(1, true)).toBe(2);
    expect(nextMastery(1, false)).toBe(0);
  });
  it("detects lesson completion", () => {
    expect(isLessonComplete(4, 4)).toBe(true);
    expect(isLessonComplete(3, 4)).toBe(false);
  });
});
