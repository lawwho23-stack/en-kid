"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ChantAlong } from "@/components/game/ChantAlong";
import {
  CELEBRATION_SETS,
  WORDS,
  getLesson,
  getWorld,
} from "@/lib/content";
import { useGame } from "@/lib/store";

function Player() {
  const search = useSearchParams();
  const router = useRouter();
  const flush = useGame((s) => s.flush);
  const world = getWorld(search.get("world") ?? "");
  const lesson = world ? getLesson(world, search.get("lesson") ?? "") : undefined;

  if (!world || !lesson) {
    return (
      <main className="flex min-h-full items-center justify-center">
        <Link href="/select" className="btn-kid bg-[#FFD84D] px-8 py-4 text-2xl text-[#3B3355]">
          Back to play →
        </Link>
      </main>
    );
  }

  const set = CELEBRATION_SETS[lesson.celebration_set];
  const firstWord = lesson.words[0];

  return (
    <main
      className="min-h-full"
      style={{ background: `linear-gradient(to bottom, ${world.colors.primary}, ${world.colors.secondary})` }}
    >
      <ChantAlong
        emoji={world.character.emoji}
        name={world.character.name}
        lines={set.song.lines}
        beatMs={set.song.beat_ms}
        wordId={firstWord}
        wordText={WORDS[firstWord].text}
        onDone={() => {
          void flush().finally(() => router.push(`/world/${world.id}`));
        }}
      />
    </main>
  );
}

export default function ChantAlongPage() {
  return (
    <Suspense>
      <Player />
    </Suspense>
  );
}
