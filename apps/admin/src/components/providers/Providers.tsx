"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";

import { Toaster } from "@/components/ui/sonner";
import { getQueryClient } from "@/lib/query-client";

// Lazy, so the devtools bundle is a chunk of its own rather than part of the
// first load. It is a `dependency` and not a `devDependency` on purpose: the
// import has to resolve at build time even for a production build, and it is
// NODE_ENV dead-code elimination that keeps it out of the shipped graph.
const Devtools =
  process.env.NODE_ENV === "development"
    ? dynamic(
        () => import("@tanstack/react-query-devtools").then((m) => m.ReactQueryDevtools),
        { ssr: false },
      )
    : () => null;

/**
 * Mounted in (dash)/layout.tsx, NOT in the root layout. The root layout also
 * wraps /login, which is deliberately - and testably - a server-only page: it
 * has to work with scripting switched off, because sign-in is the one screen
 * that must still function when everything else has gone wrong.
 *
 * `getQueryClient()` rather than `useState(() => new QueryClient())`: it already
 * handles the server/browser split, and a useState initializer still re-runs on
 * a suspended render.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" richColors />
      <Devtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
