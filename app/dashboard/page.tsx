"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { SignInForm } from "@/components/parent/SignInForm";
import { api, type ChildProfile } from "@/lib/api-client";

type Summary = Awaited<ReturnType<typeof api.summary>>;

/** /dashboard — parent area: profiles, progress, settings, delete. */
export default function DashboardPage() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [nickname, setNickname] = useState("");
  const [ageBand, setAgeBand] = useState<ChildProfile["ageBand"]>("3-4");
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api
      .me()
      .then((me) => {
        setEmail(me.email);
        setChildren(me.children);
        setSelectedId((prev) => prev ?? me.children[0]?.id ?? null);
      })
      .catch(() => setEmail(null));
  }

  // Load parent + children once, straight from the network response.
  useEffect(() => {
    refresh();
  }, []);

  // Load the selected child's summary whenever the selection changes.
  useEffect(() => {
    if (!selectedId) return;
    api
      .summary(selectedId)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [selectedId]);

  async function createProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { child } = await api.createProfile(nickname.trim(), ageBand);
      setNickname("");
      setChildren((c) => [...c, child]);
      setSelectedId(child.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create profile.");
    }
  }

  if (email === undefined) {
    return (
      <main className="flex min-h-full items-center justify-center bg-[#FFF8E7]">
        <p className="text-xl font-bold text-[#3B3355]">Loading…</p>
      </main>
    );
  }

  if (email === null) {
    return (
      <main className="flex min-h-full flex-col items-center justify-center gap-5 bg-[#FFF8E7] p-6">
        <h1 className="font-display text-4xl font-extrabold text-[#3B3355]">
          👪 Parent sign-in
        </h1>
        <SignInForm />
        <Link href="/select" className="font-bold text-[#B08CFF]">
          ← Back to play
        </Link>
      </main>
    );
  }

  const minutes = summary ? Math.round(summary.totalPlaySeconds / 60) : 0;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-5 bg-[#FFF8E7] p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl font-extrabold text-[#3B3355]">
          👪 Parent area
        </h1>
        <div className="flex gap-2">
          <Link href="/select" className="rounded-full bg-[#7FE3B5] px-4 py-2 font-bold text-[#3B3355]">
            ▶ Child mode
          </Link>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/select" })}
            className="rounded-full bg-[#3B3355]/10 px-4 py-2 font-bold text-[#3B3355]"
          >
            Sign out
          </button>
        </div>
      </div>
      <p className="font-semibold text-[#3B3355]/70">Signed in as {email}</p>

      <section className="rounded-[28px] border-4 border-[#8ED8F8] p-4">
        <h2 className="font-display text-2xl font-extrabold text-[#3B3355]">Children</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {children.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              className={`rounded-full px-4 py-2 font-bold ${selectedId === c.id ? "bg-[#B08CFF] text-white" : "bg-[#3B3355]/10 text-[#3B3355]"}`}
            >
              {c.nickname} ({c.ageBand})
            </button>
          ))}
          {children.length === 0 && (
            <p className="font-semibold text-[#3B3355]/60">No profiles yet — add one below.</p>
          )}
        </div>
        <form onSubmit={createProfile} className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="nickname" className="font-bold text-[#3B3355]">Nickname</label>
            <input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Lily"
              maxLength={24}
              className="block rounded-2xl border-4 border-[#B08CFF] px-3 py-2 text-lg text-[#3B3355]"
            />
          </div>
          <div>
            <label htmlFor="ageband" className="font-bold text-[#3B3355]">Age</label>
            <select
              id="ageband"
              value={ageBand}
              onChange={(e) => setAgeBand(e.target.value as ChildProfile["ageBand"])}
              className="block rounded-2xl border-4 border-[#B08CFF] px-3 py-2 text-lg text-[#3B3355]"
            >
              <option value="1-2">1–2</option>
              <option value="3-4">3–4</option>
              <option value="5">5</option>
            </select>
          </div>
          <button type="submit" className="btn-kid bg-[#7FE3B5] px-6 py-3 text-xl text-[#3B3355]">
            + Add
          </button>
        </form>
        {error && <p className="mt-2 font-bold text-red-600">{error}</p>}
      </section>

      {summary && (
        <section className="rounded-[28px] border-4 border-[#FFD84D] p-4">
          <h2 className="font-display text-2xl font-extrabold text-[#3B3355]">
            {summary.child.nickname}&apos;s progress 📈
          </h2>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["⭐ Stars", String(summary.state?.totalStars ?? 0)],
              ["📚 Words known", String(summary.wordsLearned)],
              ["🌱 Learning", String(summary.wordsInProgress)],
              ["🌟 Stickers", String(summary.stickerCount)],
              ["⏱ Play time", `${minutes} min`],
              ["🎮 Sessions", String(summary.sessionCount)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-white p-3 text-center shadow">
                <p className="text-2xl font-black text-[#3B3355]">{value}</p>
                <p className="font-bold text-[#3B3355]/60">{label}</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!confirm(`Delete ${summary.child.nickname}'s profile and all their data?`)) return;
              await api.deleteProfile(summary.child.id);
              setSelectedId(null);
              setSummary(null);
              refresh();
            }}
            className="mt-3 rounded-full bg-red-100 px-4 py-2 font-bold text-red-700"
          >
            Delete this profile 🗑
          </button>
        </section>
      )}

      <section className="rounded-[28px] border-4 border-red-200 p-4">
        <h2 className="font-display text-2xl font-extrabold text-[#3B3355]">Settings</h2>
        <button
          type="button"
          onClick={async () => {
            if (!confirm("Delete your account and ALL data? This cannot be undone.")) return;
            await api.deleteAccount();
            await signOut({ callbackUrl: "/" });
          }}
          className="mt-2 rounded-full bg-red-500 px-5 py-2 font-bold text-white"
        >
          Delete my account
        </button>
      </section>
    </main>
  );
}
