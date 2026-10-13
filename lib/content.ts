import worldsJson from "@/content/worlds.json";

export type AgeBand = "1-2" | "3-4" | "5";
export type ActivityId = "tap-and-hear" | "listen-and-pick" | "chant-along";

export type WordEntry = {
  text: string;
  emoji: string;
  phrase: string;
  pool: string;
};

export type Lesson = {
  id: string;
  words: string[];
  activities: string[];
  choices_per_question: { age_1_3: number; age_4_5: number };
  distractor_pool: string;
  celebration_set: string;
};

export type Character = {
  id: string;
  name: string;
  emoji: string;
  voice: string;
  greeting: string;
};

export type World = {
  id: string;
  title: string;
  emoji: string;
  colors: { primary: string; secondary: string };
  character: Character;
  lessons: Lesson[];
};

export type CelebrationSet = {
  praise: string[];
  retry: string[];
  celebration_line: string;
  motivation: string[];
  chants: string[];
  song: { title: string; beat_ms: number; lines: string[] };
};

type WorldsFile = {
  version: number;
  worlds: World[];
  words: Record<string, WordEntry>;
  celebration_sets: Record<string, CelebrationSet>;
};

const data = worldsJson as WorldsFile;

export const WORLDS: World[] = data.worlds;
export const WORDS: Record<string, WordEntry> = data.words;
export const CELEBRATION_SETS: Record<string, CelebrationSet> =
  data.celebration_sets;

export function getWorld(id: string): World | undefined {
  return WORLDS.find((w) => w.id === id);
}

export function getLesson(world: World, lessonId: string): Lesson | undefined {
  return world.lessons.find((l) => l.id === lessonId);
}

export function getWord(id: string): WordEntry | undefined {
  return WORDS[id];
}

/** Ages 1-3 see 2 cards; ages 4-5 see 3 cards. */
export function choicesForAge(lesson: Lesson, ageBand: AgeBand): number {
  return ageBand === "1-2"
    ? lesson.choices_per_question.age_1_3
    : lesson.choices_per_question.age_4_5;
}

/** Fill celebration templates: {word}, {letter} (first letter, upper). */
export function fillTemplate(template: string, word: string): string {
  return template
    .replaceAll("{word}", word)
    .replaceAll("{letter}", word.charAt(0).toUpperCase());
}

function articleFor(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

/** Question prompt text. Must match scripts/generate_audio.py prompt_for. */
export function promptFor(wordText: string, pool: string): string {
  if (pool === "colors") return `Where is ${wordText}?`;
  return `Where is ${articleFor(wordText)} ${wordText}?`;
}

function setForWord(wordId: string): CelebrationSet {
  for (const world of WORLDS) {
    for (const lesson of world.lessons) {
      if (lesson.words.includes(wordId)) {
        return CELEBRATION_SETS[lesson.celebration_set];
      }
    }
  }
  return CELEBRATION_SETS["momo-cheer"];
}

/**
 * Every clip id the engine can request.
 * MUST match scripts/generate_audio.py build_inventory exactly.
 */
export function allTextIds(): string[] {
  const ids = new Set<string>();
  for (const world of WORLDS) {
    ids.add(`greeting:${world.character.id}`);
  }
  for (const [wordId, word] of Object.entries(WORDS)) {
    const set = setForWord(wordId);
    ids.add(`word:${wordId}`);
    ids.add(`phrase:${wordId}`);
    ids.add(`prompt:${wordId}`);
    ids.add(`celebration:${wordId}`);
    ids.add(`chant:${wordId}`);
    for (const chant of set.chants.slice(1)) {
      ids.add(`line:${fillTemplate(chant, word.text)}`);
    }
    for (const line of set.song.lines) {
      ids.add(`line:${fillTemplate(line, word.text)}`);
    }
  }
  for (const [setId, set] of Object.entries(CELEBRATION_SETS)) {
    set.praise.forEach((_, i) => ids.add(`praise:${setId}:${i}`));
    set.retry.forEach((_, i) => ids.add(`retry:${setId}:${i}`));
    set.motivation.forEach((_, i) => ids.add(`motivation:${setId}:${i}`));
  }
  return [...ids].sort();
}

/** The smallest complete voice set needed by one lesson activity. */
export function audioIdsForActivity(
  lesson: Lesson,
  activity: ActivityId,
): string[] {
  if (activity === "tap-and-hear") {
    return lesson.words.flatMap((word) => [`word:${word}`, `phrase:${word}`]);
  }

  const set = CELEBRATION_SETS[lesson.celebration_set];
  if (activity === "chant-along") {
    const wordId = lesson.words[0];
    const word = WORDS[wordId].text;
    return [
      `chant:${wordId}`,
      ...set.song.lines.map((line) => `line:${fillTemplate(line, word)}`),
    ];
  }

  const ids = lesson.words.flatMap((wordId) => {
    const word = WORDS[wordId].text;
    return [
      `prompt:${wordId}`,
      `celebration:${wordId}`,
      `chant:${wordId}`,
      ...set.song.lines.map((line) => `line:${fillTemplate(line, word)}`),
    ];
  });
  set.praise.forEach((_, index) =>
    ids.push(`praise:${lesson.celebration_set}:${index}`),
  );
  set.retry.forEach((_, index) =>
    ids.push(`retry:${lesson.celebration_set}:${index}`),
  );
  set.motivation.forEach((_, index) =>
    ids.push(`motivation:${lesson.celebration_set}:${index}`),
  );
  return [...new Set(ids)];
}
