"use client";

import { AlertCircle } from "lucide-react";
import { useEffect } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * The (print) twin of (dash)/error.tsx. `retry`, not `reset`: every page here
 * is a fetch, and `reset` would re-render without re-fetching, landing straight
 * back on the error.
 */
export default function PrintError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      {/* it stands in for the whole page, so it keeps the page's one <h1> */}
      <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
      <Alert variant="destructive" data-testid="segment-error">
        <AlertCircle />
        <AlertTitle>This page could not be loaded</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{error.message}</p>
          {error.digest ? (
            <p className="font-mono text-xs opacity-70">digest {error.digest}</p>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() => retry()}
            data-testid="segment-error-retry"
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
