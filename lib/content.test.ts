import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allTextIds, CELEBRATION_SETS, WORDS, WORLDS } from "@/lib/content";

/** Every word in content must have a clip id in the manifest (doc section 19). */
describe("audio manifest coverage", () => {
  it("manifest exists and every text id resolves (synth fallback counts)", () => {
    const manifest = JSON.parse(
      readFileSync("public/audio/audio-manifest.json", "utf8"),
    ) as { clips: Record<string, string> };
    // Placeholder phase: empty clips map + synth fallback is valid.
    // Once TTS files land, every id below must have a URL.
    const ids = allTextIds();
    expect(ids.length).toBeGreaterThan(100);
    const missing = ids.filter((id) => !manifest.clips[id]);
    if (Object.keys(manifest.clips).length > 0) {
      expect(missing).toEqual([]);
    } else {
      expect(missing.length).toBe(ids.length); // all synth for now
    }
  });
});

describe("content model", () => {
  it("has 2 worlds with lessons referencing known words", () => {
    expect(WORLDS.length).toBe(2);
    for (const world of WORLDS) {
      expect(world.character.name).toBeTruthy();
      for (const lesson of world.lessons) {
        expect(lesson.words.length).toBeGreaterThanOrEqual(4);
        for (const w of lesson.words) {
          expect(WORDS[w], `unknown word ${w}`).toBeDefined();
        }
        expect(
          CELEBRATION_SETS[lesson.celebration_set],
          `unknown set ${lesson.celebration_set}`,
        ).toBeDefined();
      }
    }
  });

  it("animal farm has 20 words", () => {
    const farm = WORLDS.find((w) => w.id === "animal-farm")!;
    const words = farm.lessons.flatMap((l) => l.words);
    expect(new Set(words).size).toBe(20);
  });
});
