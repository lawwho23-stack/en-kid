"use client";

import { motion } from "framer-motion";

/** Parent gate: press and hold 3s. A toddler cannot pass, an adult can. */
export function ParentGate({ onUnlock }: { onUnlock: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[28px] bg-[#FFF8E7] p-8 text-center shadow-xl">
      <p className="text-2xl font-black text-[#3B3355]">Grown-ups only</p>
      <p className="max-w-xs text-lg font-semibold text-[#3B3355]/70">
        Press and hold the button for 3 seconds to enter the parent area.
      </p>
      <motion.button
        type="button"
        className="relative h-24 w-64 overflow-hidden rounded-full bg-[#B08CFF] text-xl font-black text-white"
        whileTap={{ scale: 0.97 }}
        onPointerDown={(e) => {
          const el = e.currentTarget;
          const fill = el.querySelector("[data-fill]") as HTMLElement | null;
          if (!fill) return;
          fill.style.transition = "width 3s linear";
          fill.style.width = "100%";
          const done = setTimeout(onUnlock, 3000);
          const cancel = () => {
            clearTimeout(done);
            fill.style.transition = "width 0.2s";
            fill.style.width = "0%";
            el.removeEventListener("pointerup", cancel);
            el.removeEventListener("pointerleave", cancel);
          };
          el.addEventListener("pointerup", cancel);
          el.addEventListener("pointerleave", cancel);
        }}
      >
        <span data-fill className="absolute inset-y-0 left-0 w-0 bg-[#7FE3B5]" aria-hidden />
        <span className="relative">Hold me 👆</span>
      </motion.button>
    </div>
  );
}
