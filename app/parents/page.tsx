"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ParentGate } from "@/components/game/ParentGate";

/** /parents — parent gate first, then the dashboard. Child never sees past here. */
export default function ParentsPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-5 bg-[#3B3355] p-6">
      <Link href="/select" className="rounded-full bg-white/20 px-5 py-2 text-xl font-bold text-white" aria-label="Back to play">
        ← Back to play
      </Link>
      <ParentGate onUnlock={() => router.push("/dashboard")} />
    </main>
  );
}
