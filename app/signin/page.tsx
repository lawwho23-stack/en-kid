import Link from "next/link";
import { SignInForm } from "@/components/parent/SignInForm";

export default function SignInPage() {
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
