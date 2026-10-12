"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { audio } from "@/lib/audio/engine";
import { getWorld, type AgeBand } from "@/lib/content";
import { useGame } from "@/lib/store";

const ACTIVITIES = [
  { id: "tap-and-hear", emoji: "👆", title: "Tap & Hear" },
  { id: "listen-and-pick", emoji: "👂", title: "Listen & Pick" },
  { id: "chant-along", emoji: "🎵", title: "Chant Along" },
];

/** A character's world: lessons x activities. */
export default function WorldPage() {
  const params = useParams<{ id: string }>();
  const world = getWorld(params.id);
  const beginSession = useGame((s) => s.beginSession);
  const flush = useGame((s) => s.flush);
  const [age, setAge] = useState<AgeBand>("3-4");
  const greeted = useRef(false);

  useEffect(() => {
    if (world) beginSession(world.id);
    return () => {
      void flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world?.id]);

  /** First tap anywhere: unlock audio + character says hi (sound check). */
  function greet() {
    audio.unlock();
    if (!world || greeted.current) return;
    greeted.current = true;
    void audio.preload([`greeting:${world.character.id}`]);
    audio.playGreeting(world.character.id);
  }

  if (!world) {
    return (
      <main className="flex min-h-full items-center justify-center bg-[#8ED8F8] p-6">
        <div className="rounded-[28px] bg-[#FFF8E7] p-8 text-center">
          <p className="text-2xl font-black text-[#3B3355]">World not found 😢</p>
          <Link href="/select" className="btn-kid mt-4 inline-block bg-[#FFD84D] px-8 py-4 text-2xl text-[#3B3355]">
            Back
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className="flex min-h-full flex-col items-center gap-5 p-6"
      onPointerDown={greet}
      style={{ background: `linear-gradient(to bottom, ${world.colors.primary}, ${world.colors.secondary})` }}
    >
      <div className="flex w-full max-w-2xl items-center justify-between">
        <Link href="/select" className="rounded-full bg-white/70 px-5 py-2 text-xl font-bold text-[#3B3355]" aria-label="Back">
          ←
        </Link>
        <h1 className="font-display text-4xl font-extrabold text-white drop-shadow">
          {world.character.emoji} {world.title}
        </h1>
        <span className="w-14" />
      </div>

      <div className="flex gap-2 rounded-full bg-white/60 p-1">
        {(["1-2", "3-4"] as AgeBand[]).map((band) => (
          <button
            key={band}
            type="button"
            onClick={() => setAge(band)}
            className={`rounded-full px-4 py-2 text-lg font-bold ${age === band ? "bg-[#FFD84D] text-[#3B3355]" : "text-[#3B3355]/70"}`}
          >
            {band === "1-2" ? "👶 1–3 yrs" : "🧒 4–5 yrs"}
          </button>
        ))}
      </div>

      <div className="flex w-full max-w-2xl flex-col gap-4">
        {world.lessons.map((lesson, i) => (
          <section key={lesson.id} className="rounded-[28px] bg-[#FFF8E7]/95 p-4 shadow-xl">
            <h2 className="font-display text-2xl font-extrabold text-[#3B3355]">
              Lesson {i + 1} 🎈
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {ACTIVITIES.map((a) => (
                <Link
                  key={a.id}
                  href={`/play/${a.id}?world=${world.id}&lesson=${lesson.id}&age=${age}`}
                  className="btn-kid flex items-center justify-center gap-2 bg-[#7FE3B5] px-4 py-5 text-2xl text-[#3B3355]"
                >
                  {a.emoji} {a.title}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
