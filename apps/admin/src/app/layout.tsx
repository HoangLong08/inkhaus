import type { Metadata } from "next";

import { ThemeProvider } from "@/components/providers/ThemeProvider";

import "./globals.css";

export const metadata: Metadata = {
  title: "INKHAUS Back Office",
  description: "Order production and bulk quote triage.",
  // belt and braces alongside robots.ts - this app should never be indexed
  robots: { index: false, follow: false },
};

/**
 * `suppressHydrationWarning` is required by next-themes: it writes the resolved
 * theme onto <html> from a blocking script before React hydrates, so the server
 * markup and the first client pass legitimately disagree on that one attribute.
 *
 * ThemeProvider lives here rather than in (dash) because /login needs the right
 * theme too, and it issues no requests - the sign-in page stays a pure server
 * render with no data fetching. The query provider, which does fetch, is mounted
 * one level down in (dash)/layout.tsx instead.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
