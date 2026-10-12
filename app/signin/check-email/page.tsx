import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-4 bg-[#FFF8E7] p-6 text-center">
      <p className="text-6xl">📧</p>
      <h1 className="font-display text-4xl font-extrabold text-[#3B3355]">
        Check your email!
      </h1>
      <p className="max-w-sm text-xl font-semibold text-[#3B3355]/70">
        Tap the sign-in link we sent you. You can close this page.
      </p>
      <Link href="/select" className="font-bold text-[#B08CFF]">
        ← Back to play
      </Link>
    </main>
  );
}
