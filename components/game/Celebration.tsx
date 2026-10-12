"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";
import type { CelebrationTier } from "@/lib/mastery";

function Sparkles({ count, emoji }: { count: number; emoji: string }) {
  const pieces = Array.from({ length: count }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((i) => (
        <motion.span
          key={i}
          className="absolute text-3xl"
          style={{
            left: `${8 + ((i * 37) % 84)}%`,
            top: `${6 + ((i * 53) % 70)}%`,
          }}
          initial={{ scale: 0, opacity: 0, rotate: 0 }}
          animate={{ scale: [0, 1.4, 1], opacity: [0, 1, 0.9], rotate: 360 }}
          transition={{ duration: 1.2, delay: (i % 8) * 0.08, repeat: Infinity, repeatDelay: 0.6 }}
        >
          {emoji}
        </motion.span>
      ))}
    </div>
  );
}

/**
 * Tiered celebration overlay (doc 8.1). Any tap skips — a toddler ready
 * for the next word is never stuck waiting.
 */
export function Celebration({
  tier,
  line,
  songTitle,
  stickerEmoji,
  onSkip,
  autoMs,
}: {
  tier: CelebrationTier;
  line: string;
  songTitle?: string;
  stickerEmoji?: string;
  onSkip: () => void;
  autoMs: number;
}) {
  useEffect(() => {
    const t = setTimeout(onSkip, autoMs);
    return () => clearTimeout(t);
  }, [onSkip, autoMs]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#3B3355]/60 p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onSkip}
      role="alert"
    >
      {tier === 1 && <Sparkles count={10} emoji="✨" />}
      {tier === 2 && <Sparkles count={16} emoji="⭐" />}
      {tier === 3 && <Sparkles count={26} emoji="🎉" />}
      <motion.div
        className="flex max-w-md flex-col items-center gap-3 rounded-[28px] bg-[#FFF8E7] p-8 text-center shadow-2xl"
        initial={{ scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", bounce: 0.5 }}
      >
        <span className="text-7xl" role="img" aria-hidden>
          {tier === 3 ? "🏆" : tier === 2 ? "🌟" : "🎈"}
        </span>
        <p className="text-3xl font-black text-[#3B3355]">{line}</p>
        {tier >= 2 && songTitle && (
          <p className="text-xl font-bold text-[#B08CFF]">🎵 {songTitle}</p>
        )}
        {tier === 3 && stickerEmoji && (
          <p className="text-xl font-bold text-[#3B3355]">
            Sticker earned! <span className="text-4xl">{stickerEmoji}</span>
          </p>
        )}
        <p className="text-base font-semibold text-[#3B3355]/60">Tap to continue 👆</p>
      </motion.div>
    </motion.div>
  );
}
