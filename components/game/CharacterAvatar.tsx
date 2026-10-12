"use client";

import { motion } from "framer-motion";

export type Mood = "idle" | "happy" | "encourage";

/**
 * Placeholder character art: big expressive emoji in a soft blob.
 * Real illustrated art + 3-state animation replaces this later.
 */
export function CharacterAvatar({
  emoji,
  name,
  mood,
  size = 128,
}: {
  emoji: string;
  name: string;
  mood: Mood;
  size?: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1" aria-label={name}>
      <motion.div
        className="flex items-center justify-center rounded-full bg-[#FFF8E7] shadow-lg"
        style={{ width: size, height: size }}
        animate={
          mood === "happy"
            ? { scale: [1, 1.15, 1], rotate: [0, -6, 6, 0] }
            : mood === "encourage"
              ? { rotate: [0, -8, 8, 0], y: [0, 6, 0] }
              : { y: [0, -8, 0], scale: [1, 1.03, 1] }
        }
        transition={
          mood === "idle"
            ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.7, ease: "easeOut" }
        }
      >
        <span style={{ fontSize: size * 0.55 }} role="img" aria-hidden>
          {emoji}
        </span>
      </motion.div>
      <span className="rounded-full bg-[#3B3355]/80 px-4 py-1 text-lg font-bold text-white">
        {name}
      </span>
    </div>
  );
}
