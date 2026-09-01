import type { Metadata } from "next";

import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = { title: "Sign in — INKHAUS Back Office" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper-2 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <p className="text-lg font-black uppercase tracking-tight">INKHAUS</p>
          <p className="text-sm text-ink-3">Back office</p>
        </div>

        <div className="rounded-lg border border-line bg-paper p-6 shadow-sm">
          <LoginForm next={next && next.startsWith("/") ? next : "/"} />
        </div>

        <p className="mt-4 text-xs text-ink-3">Staff accounts only. Sessions last 12 hours.</p>
      </div>
    </main>
  );
}
