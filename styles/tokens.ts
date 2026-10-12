/**
 * Kid design tokens (docs/architecture.md section 13).
 * Bright, soft, high contrast for small eyes. Rounded everything.
 */
export const TOKENS = {
  colors: {
    sky: "#8ED8F8",
    sun: "#FFD84D",
    coral: "#FF8A7A",
    mint: "#7FE3B5",
    grape: "#B08CFF",
    cream: "#FFF8E7",
    ink: "#3B3355",
  },
  radius: {
    card: "28px",
    button: "999px",
  },
  tapTarget: {
    min: 96,
    ideal: 120,
  },
  /** Celebration tier thresholds (tunable — test with a real child). */
  celebration: {
    mediumStreak: 3, // streak of 3 correct -> chant + dance
    songEveryLessons: 1, // lesson complete -> full song
  },
  idleRepeatSeconds: 5,
  hintAfterMisses: 2,
} as const;

export type TokenColors = keyof typeof TOKENS.colors;
