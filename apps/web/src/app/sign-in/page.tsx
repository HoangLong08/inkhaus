import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCustomer } from "@/lib/dal";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = {
  title: "Sign in — INKHAUS",
  description: "Sign in with Google to see every INKHAUS order placed with your email address.",
  // a personalised page has nothing to offer a crawler
  robots: { index: false, follow: false },
};

/**
 * Entirely server-rendered: a plain HTML form posting to a Route Handler, with
 * no client component anywhere in the tree. Sign-in is the one page that has to
 * work when everything else has gone wrong, and nothing here needs JavaScript.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const target = safeNext(next);

  // already signed in - nothing to do here but go where they were headed
  if (await getCustomer()) redirect(target);

  return (
    <div className="pt-[calc(var(--nav-h)+50px)]">
      <div className="edge grid gap-14 pb-28 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        <header className="border-b hairline pb-7 lg:border-b-0 lg:pb-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-acid-2">Your account</p>
          <h1 className="display mt-4 text-[clamp(2.6rem,8vw,5.5rem)]">Every order, one place.</h1>
          <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-ink/50">
            Sign in with the email you checked out with and every INKHAUS order placed under it is
            waiting — no order numbers to dig out of your inbox.
          </p>
        </header>

        <div className="max-w-sm rounded-2xl border hairline bg-paper-2 p-7">
          {error ? (
            <p
              role="alert"
              data-testid="signin-error"
              className="mb-5 rounded-xl border border-flame/30 bg-flame/10 px-4 py-3 text-[13px] leading-relaxed text-flame"
            >
              {error}
            </p>
          ) : null}

          <form method="POST" action="/api/auth/google/start" data-testid="signin-form">
            <input type="hidden" name="next" value={target} />
            <button
              type="submit"
              data-testid="google-signin"
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border hairline bg-paper px-4 py-3.5 text-[13px] font-bold uppercase tracking-[0.12em] transition hover:border-ink"
            >
              <GoogleMark />
              Continue with Google
            </button>
          </form>

          <p className="mt-5 text-[11px] leading-relaxed text-ink/40">
            We only ever read your name, email and profile picture. There is no password to forget —
            and no password of yours for us to lose.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Google's four-colour G, inline so the page pulls in no external asset */
function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="size-4">
      <path
        fill="#4285F4"
        d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.3z"
      />
      <path
        fill="#34A853"
        d="M24 46c6 0 11-2 14.5-5.2l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.6-3.9-12.3-9.1H4.3v5.7C7.8 41.1 15.3 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.7 28.3c-.4-1.3-.7-2.7-.7-4.3s.3-3 .7-4.3v-5.7H4.3A22 22 0 0 0 2 24c0 3.6.9 6.9 2.3 9.9l7.4-5.6z"
      />
      <path
        fill="#EA4335"
        d="M24 10.6c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4 30 2 24 2 15.3 2 7.8 6.9 4.3 14.1l7.4 5.7c1.7-5.2 6.6-9.2 12.3-9.2z"
      />
    </svg>
  );
}
