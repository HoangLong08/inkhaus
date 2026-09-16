import { AlertCircle } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loginErrorCode } from "@/i18n/login-errors";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign in — INKHAUS Back Office" };

/**
 * Entirely server-rendered: a plain HTML form posting to a Route Handler, with
 * no client component anywhere in the tree. Sign-in is the one page that has to
 * work when everything else has gone wrong, and nothing here needs JavaScript.
 *
 * Every shadcn component used below is plain markup or a Slot - none of them
 * carry "use client" - which is why this page can adopt them without giving that
 * up. The query provider and the toaster are mounted in (dash)/layout.tsx
 * precisely so they never reach here.
 *
 * Two constraints an e2e test enforces: this page must work with scripting off,
 * and it must contain exactly one <form>.
 *
 * It is translated SERVER-SIDE ONLY, with `getTranslations()`. There is no
 * NextIntlClientProvider anywhere above it - that would be a client component in
 * this tree, which is exactly what the rule above forbids - and `?error=` is a
 * CODE rather than a sentence, because a page cannot translate a string it was
 * handed already written.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const [{ next, error }, t] = await Promise.all([searchParams, getTranslations("Login")]);

  // An unrecognised code - an old bookmark, a hand-typed URL - still says
  // something useful rather than rendering the raw code at the operator.
  const code = loginErrorCode(error);

  return (
    <main className="bg-muted flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <p className="text-lg font-black uppercase tracking-tight">{t("brand")}</p>
          <p className="text-muted-foreground text-sm">{t("brandSub")}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Alert already sets role="alert" */}
            {code ? (
              <Alert variant="destructive" data-testid="login-error">
                <AlertCircle />
                <AlertTitle>{t("errorTitle")}</AlertTitle>
                <AlertDescription>{t(`errors.${code}`)}</AlertDescription>
              </Alert>
            ) : null}

            <form method="POST" action="/api/auth/google/start" data-testid="google-form">
              <input type="hidden" name="next" value={safeNext(next)} />
              <Button
                type="submit"
                variant="outline"
                className="w-full"
                data-testid="google-signin"
              >
                <GoogleMark />
                {t("submit")}
              </Button>
            </form>
          </CardContent>

          <CardFooter>
            <p className="text-muted-foreground text-xs">{t("footer")}</p>
          </CardFooter>
        </Card>
      </div>
    </main>
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
