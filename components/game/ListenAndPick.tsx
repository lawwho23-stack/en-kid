"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { audio } from "@/lib/audio/engine";
import {
  CELEBRATION_SETS,
  WORDS,
  choicesForAge,
  fillTemplate,
  type AgeBand,
  type Lesson,
  type World,
} from "@/lib/content";
import {
  buildChoices,
  celebrationTier,
  nextMastery,
  pickNextWord,
  type Choice,
} from "@/lib/mastery";
import { useGame } from "@/lib/store";
import { TOKENS } from "@/styles/tokens";
import { CharacterAvatar, type Mood } from "./CharacterAvatar";
import { Celebration } from "./Celebration";
import { PictureCard, type CardState } from "./PictureCard";

type Round = { word: string; choices: Choice[]; slots: number[] };

/**
 * Core loop: Listen and Pick (docs/architecture.md section 8.1).
 * Voice says the word -> 2-3 cards -> tap -> celebrate or gentle retry.
 */
export function ListenAndPick({
  world,
  lesson,
  ageBand,
  onDone,
}: {
  world: World;
  lesson: Lesson;
  ageBand: AgeBand;
  onDone: () => void;
}) {
  const recordEvent = useGame((s) => s.recordEvent);
  const addStars = useGame((s) => s.addStars);
  const addSticker = useGame((s) => s.addSticker);
  const flush = useGame((s) => s.flush);

  const count = choicesForAge(lesson, ageBand);
  const showLabel = ageBand !== "1-2";
  const set = CELEBRATION_SETS[lesson.celebration_set];
  const poolIds = useMemo(
    () =>
      Object.keys(WORDS).filter(
        (id) => WORDS[id].pool === lesson.distractor_pool,
      ),
    [lesson.distractor_pool],
  );

  const [round, setRound] = useState<Round>(() => {
    const w = pickNextWord(lesson.words, {}, null);
    const dealt = buildChoices(w, poolIds, count, [], {});
    return { word: w, choices: dealt.choices, slots: [dealt.slot] };
  });
  const [mastery, setMastery] = useState<Record<string, number>>({});
  const [doneWords, setDoneWords] = useState<string[]>([]);
  const [misses, setMisses] = useState(0);
  const [streak, setStreak] = useState(0);
  const [tappedWrong, setTappedWrong] = useState<string | null>(null);
  const [tappedRight, setTappedRight] = useState(false);
  const [mood, setMood] = useState<Mood>("idle");
  const [tier, setTier] = useState<0 | 1 | 2 | 3>(0);
  const [praiseLine, setPraiseLine] = useState("");
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speakWord = useCallback(
    (id: string) => {
      audio.unlock();
      audio.playPrompt(id);
    },
    [],
  );

  // Entry: preload clips + speak the first word. Audio only, no setState.
  useEffect(() => {
    audio.unlock();
    const ids = lesson.words.flatMap((w) => [
      `word:${w}`,
      `phrase:${w}`,
      `prompt:${w}`,
      `celebration:${w}`,
      `chant:${w}`,
    ]);
    void audio.preload(ids);
    const t = setTimeout(() => speakWord(round.word), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Idle repeat every 5s while waiting for an answer. Timer only.
  useEffect(() => {
    if (tier !== 0) return;
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(
      () => speakWord(round.word),
      TOKENS.idleRepeatSeconds * 1000,
    );
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [round.word, misses, tier, speakWord]);

  function ask(word: string, m: Record<string, number>, slotHistory: number[]) {
    const dealt = buildChoices(word, poolIds, count, slotHistory, m);
    setRound({
      word,
      choices: dealt.choices,
      slots: [...slotHistory.slice(-6), dealt.slot],
    });
    setMisses(0);
    setTappedRight(false);
    setMood("idle");
    setTier(0);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    setTimeout(() => speakWord(word), 350);
  }

  function handleTap(choice: Choice) {
    audio.unlock();
    if (tier !== 0) return;
    if (idleTimer.current) clearTimeout(idleTimer.current);
    const word = round.word;

    if (choice.isCorrect) {
      const attempts = misses + 1;
      const hintUsed = misses >= TOKENS.hintAfterMisses;
      recordEvent({ word_id: word, correct: true, attempts, hint_used: hintUsed });
      const m = { ...mastery, [word]: nextMastery(mastery[word] ?? 0, true) };
      setMastery(m);

      const newStreak = streak + 1;
      setStreak(newStreak);
      const newDone = doneWords.includes(word) ? doneWords : [...doneWords, word];
      setDoneWords(newDone);
      const lessonDone = newDone.length >= lesson.words.length;
      const t = celebrationTier(newStreak, lessonDone, TOKENS.celebration.mediumStreak);
      const setId = lesson.celebration_set;

      const wordText = WORDS[word].text;
      // Tier 2 alternates motivation and praise lines so both pools get heard.
      const usePraise = newStreak % 2 === 1;
      const tier2Text = usePraise
        ? set.praise[newStreak % set.praise.length]
        : set.motivation[newStreak % set.motivation.length];
      const tier2Id = usePraise
        ? `praise:${setId}:${newStreak % set.praise.length}`
        : `motivation:${setId}:${newStreak % set.motivation.length}`;
      const line =
        t === 1
          ? fillTemplate(set.celebration_line, wordText)
          : t === 2
            ? tier2Text
            : `Lesson complete!`;
      setPraiseLine(line);
      setTappedRight(true);
      setMood("happy");
      addStars(t === 3 ? 5 : t === 2 ? 3 : 1);

      if (t === 1) {
        audio.playCelebration(word);
        setTier(1);
      } else if (t === 2) {
        audio.playChant([`chant:${word}`, tier2Id], 0.5);
        setTier(2);
      } else {
        audio.playChant(
          set.song.lines.map((l) => `line:${fillTemplate(l, wordText)}`),
          set.song.beat_ms / 1000,
        );
        addSticker(`sticker:${word}`);
        setTier(3);
      }
    } else {
      const m = misses + 1;
      setMisses(m);
      setStreak(0);
      setTappedWrong(choice.wordId);
      setMood("encourage");
      audio.playRetry(lesson.celebration_set, m % set.retry.length);
      setTimeout(() => {
        speakWord(word);
        setTappedWrong(null);
        setMood("idle");
      }, 900);
    }
  }

  function next() {
    if (doneWords.length >= lesson.words.length) {
      void flush();
      onDone();
      return;
    }
    ask(pickNextWord(lesson.words, mastery, round.word), mastery, round.slots);
  }

  const hint = misses >= TOKENS.hintAfterMisses;

  function cardState(c: Choice): CardState {
    if (tappedRight) return c.isCorrect ? "correct" : "dim";
    if (tappedWrong === c.wordId) return "wrong";
    if (hint && c.isCorrect) return "hint";
    return "idle";
  }

  const word = WORDS[round.word];

  return (
    <div
      className="flex min-h-full flex-col items-center gap-4 p-4"
      onPointerDown={() => audio.unlock()}
    >
      <div className="flex w-full max-w-2xl items-center justify-between">
        <CharacterAvatar emoji={world.character.emoji} name={world.character.name} mood={mood} size={96} />
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => speakWord(round.word)}
            aria-label="Hear the word again"
            className="flex h-24 w-24 items-center justify-center rounded-full bg-[#FFD84D] text-5xl shadow-xl"
          >
            🔊
          </button>
          <span className="rounded-full bg-white/70 px-3 py-1 text-lg font-bold text-[#3B3355]">
            ⭐ {doneWords.length}/{lesson.words.length}
          </span>
        </div>
      </div>

      <p className="text-center text-2xl font-black text-white drop-shadow">
        {tappedRight ? praiseLine : "Listen… then tap! 👂"}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-5">
        {round.choices.map((c) => (
          <PictureCard
            key={c.wordId}
            emoji={WORDS[c.wordId].emoji}
            label={WORDS[c.wordId].text}
            showLabel={showLabel}
            state={cardState(c)}
            disabled={tier !== 0}
            onTap={() => handleTap(c)}
          />
        ))}
      </div>

      <p className="sr-only">Word: {word.text}</p>

      {tier !== 0 && (
        <Celebration
          tier={tier}
          line={praiseLine}
          songTitle={tier >= 2 ? set.song.title : undefined}
          stickerEmoji={tier === 3 ? word.emoji : undefined}
          onSkip={next}
          autoMs={tier === 1 ? 2600 : tier === 2 ? 8000 : 20000}
        />
      )}
    </div>
  );
}
