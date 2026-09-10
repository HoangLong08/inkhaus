"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Mounted in the ROOT layout, unlike the query provider - /login needs the right
 * theme too, and this costs nothing but a blocking inline script plus a context.
 * It issues no requests, so the sign-in page stays a pure server render.
 *
 * `attribute="class"` is what globals.css's `@custom-variant dark` matches on.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
