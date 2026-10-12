"use client";

import { motion } from "framer-motion";

export type CardState = "idle" | "correct" | "wrong" | "hint" | "dim";

/**
 * Big tap-first picture card. Minimum 120px target (doc section 2).
 * Text labels only for older kids (showLabel).
 */
export function PictureCard({
  emoji,
  label,
  showLabel,
  state,
  onTap,
  disabled,
}: {
  emoji: string;
  label: string;
  showLabel: boolean;
  state: CardState;
  onTap: () => void;
  disabled?: boolean;
}) {
  const glow =
    state === "hint"
      ? "ring-8 ring-[#FFD84D] shadow-[0_0_40px_#FFD84D]"
      : state === "correct"
        ? "ring-8 ring-[#7FE3B5] shadow-[0_0_40px_#7FE3B5]"
        : "shadow-xl";
  const fade = state === "wrong" || state === "dim" ? "opacity-60" : "";

  return (
    <motion.button
      type="button"
      onClick={onTap}
      disabled={disabled}
      aria-label={label}
      className={`flex min-h-[96px] min-w-[96px] flex-col items-center justify-center gap-1 rounded-[28px] border-4 border-white bg-[#FFF8E7] p-3 ${glow} ${fade}`}
      // 96px minimum target (doc section 2); grows to 160px on tablets.
      style={{ width: "clamp(104px, 38vw, 160px)", height: "clamp(104px, 38vw, 160px)" }}
      whileTap={{ scale: 0.88 }}
      animate={
        state === "correct"
          ? { scale: [1, 1.18, 1.05] }
          : state === "wrong"
            ? { x: [0, -12, 12, -8, 8, 0] }
            : state === "hint"
              ? { y: [0, -14, 0], scale: [1, 1.08, 1] }
              : { scale: 1, x: 0, y: 0 }
      }
      transition={{ duration: state === "hint" ? 0.9 : 0.5, repeat: state === "hint" ? 2 : 0 }}
    >
      <span
        className="leading-none"
        style={{ fontSize: "clamp(2.5rem, 15vw, 4.5rem)" }}
        role="img"
        aria-hidden
      >
        {emoji}
      </span>
      {showLabel && (
        <span className="text-2xl font-bold capitalize text-[#3B3355]">{label}</span>
      )}
    </motion.button>
  );
}
