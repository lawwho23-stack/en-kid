"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";

type Providers = Record<string, { id: string; name: string; type: string }>;

/** Parent sign-in: email magic link, plus dev bypass when enabled. */
export function SignInForm({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  const [providers, setProviders] = useState<Providers | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then(setProviders)
      .catch(() => setProviders({}));
  }, []);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await signIn("nodemailer", { email, callbackUrl, redirect: false });
    if (res?.error) setError("Could not send the email. Check SMTP settings.");
    else setSent(true);
  }

  if (providers === null) return <p className="text-lg font-bold">Loading…</p>;
  if (sent) {
    return (
      <p className="max-w-xs text-center text-xl font-bold text-[#3B3355]">
        📧 Check your inbox for the sign-in link!
      </p>
    );
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-3">
      {providers["nodemailer"] && (
        <form onSubmit={sendLink} className="flex flex-col gap-3">
          <label className="text-lg font-bold text-[#3B3355]" htmlFor="parent-email">
            Parent email
          </label>
          <input
            id="parent-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-2xl border-4 border-[#B08CFF] px-4 py-3 text-xl text-[#3B3355]"
          />
          <button type="submit" className="btn-kid bg-[#7FE3B5] px-6 py-4 text-2xl text-[#3B3355]">
            Email me a link 📧
          </button>
        </form>
      )}
      {providers["dev-login"] && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void signIn("dev-login", { email: email || "parent@test.com", callbackUrl });
          }}
          className="flex flex-col gap-3 rounded-2xl bg-[#FFD84D]/40 p-3"
        >
          <p className="text-sm font-bold text-[#3B3355]">
            Dev only — no real email needed:
          </p>
          <button type="submit" className="btn-kid bg-[#FFD84D] px-6 py-3 text-xl text-[#3B3355]">
            Dev login 🧪
          </button>
        </form>
      )}
      {error && <p className="font-bold text-red-600">{error}</p>}
    </div>
  );
}
