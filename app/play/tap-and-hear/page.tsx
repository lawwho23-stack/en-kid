"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { TapAndHear } from "@/components/game/TapAndHear";
import { getLesson, getWorld, type AgeBand } from "@/lib/content";
import { useGame } from "@/lib/store";

function Player() {
  const search = useSearchParams();
  const router = useRouter();
  const flush = useGame((s) => s.flush);
  const world = getWorld(search.get("world") ?? "");
  const lesson = world ? getLesson(world, search.get("lesson") ?? "") : undefined;
  const age = (search.get("age") === "1-2" ? "1-2" : "3-4") as AgeBand;

  if (!world || !lesson) {
    return (
      <main className="flex min-h-full items-center justify-center">
        <Link href="/select" className="btn-kid bg-[#FFD84D] px-8 py-4 text-2xl text-[#3B3355]">
          Back to play →
        </Link>
      </main>
    );
  }

  return (
    <main
      className="flex min-h-full flex-col"
      style={{ background: `linear-gradient(to bottom, ${world.colors.primary}, ${world.colors.secondary})` }}
    >
      <div className="flex justify-center pt-4">
        <button
          type="button"
          onClick={() => {
            void flush().finally(() => router.push(`/world/${world.id}`));
          }}
          className="rounded-full bg-white/70 px-6 py-2 text-xl font-bold text-[#3B3355]"
        >
          ✓ Done
        </button>
      </div>
      <TapAndHear
        emoji={world.character.emoji}
        name={world.character.name}
        wordIds={lesson.words}
        ageBand={age}
      />
    </main>
  );
}

export default function TapAndHearPage() {
  return (
    <Suspense>
      <Player />
    </Suspense>
  );
}
