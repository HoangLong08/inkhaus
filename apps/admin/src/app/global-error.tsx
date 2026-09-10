"use client";

import { useEffect } from "react";

import "./globals.css";

/**
 * The last resort: this replaces the root layout entirely, so it has to render
 * its own <html> and <body> and cannot rely on anything above it - no theme
 * provider, no sidebar, no fonts. Styling stays deliberately minimal for the
 * same reason: whatever broke may well be the stylesheet.
 */
export default function GlobalError({
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
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md space-y-3">
          <h1 className="text-lg font-bold">The back office crashed</h1>
          <p className="text-sm opacity-80">{error.message}</p>
          {error.digest ? (
            <p className="font-mono text-xs opacity-60">digest {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-md border px-3 py-1.5 text-sm font-semibold"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
