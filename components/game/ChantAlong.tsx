"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { audio } from "@/lib/audio/engine";
import { fillTemplate } from "@/lib/content";
import { useGame } from "@/lib/store";
import { CharacterAvatar, type Mood } from "./CharacterAvatar";

/**
 * Chant Along: call-and-response over a beat.
 * The child taps the drum to play each line — their tap IS the response beat.
 */
export function ChantAlong({
  emoji,
  name,
  lines,
  beatMs,
  wordId,
  wordText,
  onDone,
}: {
  emoji: string;
  name: string;
  lines: string[];
  beatMs: number;
  wordId: string;
  wordText: string;
  onDone: () => void;
}) {
  const addStars = useGame((s) => s.addStars);
  const [step, setStep] = useState(0);
  const [mood, setMood] = useState<Mood>("idle");
  const finished = step >= lines.length;

  function drum() {
    audio.unlock();
    if (finished) return;
    const filled = fillTemplate(lines[step], wordText);
    audio.playChant([`chant:${wordId}`, `line:${filled}`], beatMs / 1000);
    setMood("happy");
    setTimeout(() => setMood("idle"), 600);
    const next = step + 1;
    setStep(next);
    if (next >= lines.length) {
      addStars(3);
    }
  }

  return (
    <div
      className="flex min-h-full flex-col items-center gap-4 p-4"
      onPointerDown={() => audio.unlock()}
    >
      <CharacterAvatar emoji={emoji} name={name} mood={mood} size={110} />
      <div className="flex gap-2">
        {lines.map((_, i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full ${i < step ? "bg-[#7FE3B5]" : "bg-white/50"}`}
          />
        ))}
      </div>
      {!finished ? (
        <>
          <p className="max-w-md text-center text-2xl font-black text-white drop-shadow">
            Tap the drum! 🥁 ({step + 1}/{lines.length})
          </p>
          <motion.button
            type="button"
            onClick={drum}
            whileTap={{ scale: 0.85 }}
            className="flex h-44 w-44 items-center justify-center rounded-full border-8 border-white bg-[#FF8A7A] text-8xl shadow-2xl"
            aria-label="Play the next chant line"
          >
            🥁
          </motion.button>
        </>
      ) : (
        <>
          <p className="text-center text-3xl font-black text-white drop-shadow">
            You sang the whole song! 🎶
          </p>
          <button
            type="button"
            onClick={onDone}
            className="rounded-full bg-[#FFD84D] px-10 py-5 text-2xl font-black text-[#3B3355] shadow-xl"
          >
            Yay! 👏
          </button>
        </>
      )}
    </div>
  );
}
