"use client";

import { useEffect, useState } from "react";
import { audio } from "@/lib/audio/engine";
import { WORDS, type AgeBand } from "@/lib/content";
import { useGame } from "@/lib/store";
import { CharacterAvatar, type Mood } from "./CharacterAvatar";
import { PictureCard } from "./PictureCard";

/** Tap and Hear (ages 1-3 entry): tap a picture, hear the word. No scoring. */
export function TapAndHear({
  emoji,
  name,
  wordIds,
  ageBand,
}: {
  emoji: string;
  name: string;
  wordIds: string[];
  ageBand: AgeBand;
}) {
  const recordEvent = useGame((s) => s.recordEvent);
  const [mood, setMood] = useState<Mood>("idle");
  const [heard, setHeard] = useState<string[]>([]);
  const showLabel = ageBand !== "1-2";

  useEffect(() => {
    audio.unlock();
    void audio.preload(wordIds.flatMap((w) => [`word:${w}`, `phrase:${w}`]));
  }, [wordIds]);

  function tap(wordId: string) {
    audio.unlock();
    audio.playWord(wordId);
    setTimeout(() => audio.playPhrase(wordId), 650);
    setMood("happy");
    setTimeout(() => setMood("idle"), 800);
    if (!heard.includes(wordId)) {
      setHeard((h) => [...h, wordId]);
      recordEvent({ word_id: wordId, correct: true, attempts: 1, hint_used: false });
    }
  }

  return (
    <div
      className="flex min-h-full flex-col items-center gap-4 p-4"
      onPointerDown={() => audio.unlock()}
    >
      <CharacterAvatar emoji={emoji} name={name} mood={mood} size={96} />
      <p className="text-center text-2xl font-black text-white drop-shadow">
        Tap a picture! 🎈 ({heard.length}/{wordIds.length})
      </p>
      <div className="flex max-w-2xl flex-wrap items-center justify-center gap-5">
        {wordIds.map((id) => (
          <PictureCard
            key={id}
            emoji={WORDS[id].emoji}
            label={WORDS[id].text}
            showLabel={showLabel}
            state={heard.includes(id) ? "correct" : "idle"}
            onTap={() => tap(id)}
          />
        ))}
      </div>
    </div>
  );
}
