"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ListenAndPick } from "@/components/game/ListenAndPick";
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
      className="min-h-full"
      style={{ background: `linear-gradient(to bottom, ${world.colors.primary}, ${world.colors.secondary})` }}
    >
      <ListenAndPick
        world={world}
        lesson={lesson}
        ageBand={age}
        onDone={() => {
          void flush().finally(() => router.push(`/world/${world.id}`));
        }}
      />
    </main>
  );
}

export default function ListenAndPickPage() {
  return (
    <Suspense>
      <Player />
    </Suspense>
  );
}
