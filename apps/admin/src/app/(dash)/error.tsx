"use client";

import { AlertCircle } from "lucide-react";
import { useEffect } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Next 16.3 hands this boundary `retry`, not `reset`. The distinction matters
 * here: `reset` re-renders the children without re-fetching, and every page in
 * this group IS a fetch, so it would clear the error and land straight back on
 * it. `retry` runs the server render again, which is what "Try again" promises.
 */
export default function DashError({
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
    <Alert variant="destructive" data-testid="segment-error">
      <AlertCircle />
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{error.message}</p>
        {/* the digest is the only handle on a minified production stack, so it
            is the one thing worth asking an operator to quote back */}
        {error.digest ? (
          <p className="font-mono text-xs opacity-70">digest {error.digest}</p>
        ) : null}
        <Button size="sm" variant="outline" onClick={() => retry()}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
