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
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Alert variant="destructive" data-testid="segment-error">
        <AlertCircle />
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{error.message}</p>
          {error.digest ? (
            <p className="font-mono text-xs opacity-70">digest {error.digest}</p>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => retry()}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
