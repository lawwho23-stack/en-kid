"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WORLDS } from "@/lib/content";
import { api, type ChildProfile } from "@/lib/api-client";
import { useGame } from "@/lib/store";

/** Character Select: big cute characters, zero reading required to start. */
export default function SelectPage() {
  const activeChildId = useGame((s) => s.activeChildId);
  const setActiveChild = useGame((s) => s.setActiveChild);
  const [children, setChildren] = useState<ChildProfile[] | null>(null);

  useEffect(() => {
    api
      .me()
      .then((me) => {
        setChildren(me.children);
        if (me.children.length > 0 && !useGame.getState().activeChildId) {
          setActiveChild(me.children[0].id);
        }
      })
      .catch(() => setChildren([])); // guest mode: play without sign-in
  }, [setActiveChild]);

  return (
    <main className="flex min-h-full flex-col items-center gap-5 bg-gradient-to-b from-[#8ED8F8] to-[#B08CFF] p-6">
      <div className="flex w-full max-w-2xl items-center justify-between">
        <Link href="/" className="rounded-full bg-white/70 px-5 py-2 text-xl font-bold text-[#3B3355]" aria-label="Home">
          🏠
        </Link>
        <h1 className="font-display text-4xl font-extrabold text-white drop-shadow">
          Who do you want to play with?
        </h1>
        <Link
          href="/parents"
          className="rounded-full bg-white/70 px-5 py-2 text-xl font-bold text-[#3B3355]"
          aria-label="Grown-ups area"
        >
          👪
        </Link>
      </div>

      {children !== null && children.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {children.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveChild(c.id)}
              className={`rounded-full px-5 py-2 text-lg font-bold ${
                activeChildId === c.id
                  ? "bg-[#FFD84D] text-[#3B3355]"
                  : "bg-white/60 text-[#3B3355]"
              }`}
            >
              {c.nickname} {activeChildId === c.id ? "✓" : ""}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-stretch justify-center gap-6">
        {WORLDS.map((world) => (
          <Link
            key={world.id}
            href={`/world/${world.id}`}
            className="flex w-64 flex-col items-center gap-2 rounded-[28px] border-4 border-white bg-[#FFF8E7] p-6 shadow-2xl transition-transform hover:scale-105"
          >
            <span className="text-8xl" role="img" aria-hidden>
              {world.character.emoji}
            </span>
            <span className="font-display text-3xl font-extrabold text-[#3B3355]">
              {world.character.name}
            </span>
            <span
              className="rounded-full px-4 py-1 text-lg font-bold text-[#3B3355]"
              style={{ background: world.colors.primary }}
            >
              {world.title} {world.emoji}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
