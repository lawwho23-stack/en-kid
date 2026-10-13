import { describe, expect, it } from "vitest";
import * as chantAlong from "@/components/game/ChantAlong";
import * as content from "@/lib/content";

type ActivityId = "tap-and-hear" | "listen-and-pick" | "chant-along";

const audioIdsForActivity = (
  content as unknown as {
    audioIdsForActivity?: (
      lesson: content.Lesson,
      activity: ActivityId,
    ) => string[];
  }
).audioIdsForActivity ?? (() => []);

const canStartChant = (
  chantAlong as unknown as {
    canStartChant?: (state: {
      ready: boolean;
      playing: boolean;
      finished: boolean;
    }) => boolean;
  }
).canStartChant ?? (() => false);

describe("activity audio inventory", () => {
  const lesson = content.WORLDS[0].lessons[0];

  it("loads only word and phrase voices for Tap and Hear", () => {
    expect(audioIdsForActivity(lesson, "tap-and-hear")).toEqual([
      "word:cat",
      "phrase:cat",
      "word:dog",
      "phrase:dog",
      "word:cow",
      "phrase:cow",
      "word:duck",
      "phrase:duck",
    ]);
  });

  it("loads the first word and its filled song lines for Chant Along", () => {
    expect(audioIdsForActivity(lesson, "chant-along")).toEqual([
      "chant:cat",
      "line:C, C, cat!",
      "line:Clap your hands, sing with me!",
      "line:cat! cat! You did it!",
      "line:Momo is so proud of you!",
    ]);
  });

  it("loads every possible prompt and celebration used by Listen and Pick", () => {
    const ids = audioIdsForActivity(lesson, "listen-and-pick");

    expect(ids).toContain("prompt:cat");
    expect(ids).toContain("celebration:duck");
    expect(ids).toContain("chant:cow");
    expect(ids).toContain("line:D, D, dog!");
    expect(ids).toContain("praise:momo-cheer:7");
    expect(ids).toContain("retry:momo-cheer:2");
    expect(ids).toContain("motivation:momo-cheer:2");
    expect(ids).not.toContain("word:cat");
    expect(ids).not.toContain("phrase:cat");
  });
});

describe("Chant Along readiness", () => {
  it("allows a tap only after loading and while no line is playing", () => {
    expect(
      canStartChant({ ready: false, playing: false, finished: false }),
    ).toBe(false);
    expect(
      canStartChant({ ready: true, playing: true, finished: false }),
    ).toBe(false);
    expect(
      canStartChant({ ready: true, playing: false, finished: true }),
    ).toBe(false);
    expect(
      canStartChant({ ready: true, playing: false, finished: false }),
    ).toBe(true);
  });
});
