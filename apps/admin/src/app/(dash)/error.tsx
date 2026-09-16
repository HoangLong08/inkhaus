"use client";

import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Next 16.3 hands this boundary `retry`, not `reset`. The distinction matters
 * here: `reset` re-renders the children without re-fetching, and every page in
 * this group IS a fetch, so it would clear the error and land straight back on
 * it. `retry` runs the server render again, which is what "Try again" promises.
 *
 * This boundary renders INSIDE (dash)/layout.tsx, therefore inside the intl
 * provider, so it can translate. global-error.tsx and (print)/error.tsx cannot -
 * they replace the root layout - and stay English by decision.
 */
export default function DashError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("Errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    // it stands in for the whole page, so it keeps the page's one <h1>
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("pageTitle")}</h1>
      <Alert variant="destructive" data-testid="segment-error">
        <AlertCircle />
        <AlertTitle>{t("alertTitle")}</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{error.message}</p>
          {/* the digest is the only handle on a minified production stack, so it
              is the one thing worth asking an operator to quote back */}
          {error.digest ? (
            <p className="font-mono text-xs opacity-70">{t("digest", { digest: error.digest })}</p>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() => retry()}
            data-testid="segment-error-retry"
          >
            {t("retry")}
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
