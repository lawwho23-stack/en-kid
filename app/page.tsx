import Link from "next/link";

/** Landing: one giant play button. Zero reading required beyond this. */
export default function Home() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-[#8ED8F8] to-[#7FE3B5] p-6">
      <div className="text-center">
        <p className="font-display text-6xl" role="img" aria-label="animals">
          🐱🦆🌈
        </p>
        <h1 className="font-display mt-2 text-5xl font-extrabold text-white drop-shadow-lg">
          Kids English
        </h1>
        <p className="font-display mt-1 text-2xl font-bold text-[#3B3355]">
          Tap, hear, learn! 🎈
        </p>
      </div>
      <Link
        href="/select"
        className="btn-kid bg-[#FFD84D] px-16 py-7 font-display text-4xl text-[#3B3355]"
      >
        ▶ Play!
      </Link>
      <Link
        href="/parents"
        className="rounded-full bg-white/60 px-6 py-3 text-lg font-bold text-[#3B3355]"
      >
        👪 Grown-ups
      </Link>
    </main>
  );
}
