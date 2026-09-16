import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/providers/ThemeProvider";

import "./globals.css";

/**
 * The two faces the back office is drawn in. `next/font/google` fetches them at
 * build time and self-hosts the woff2 out of /_next/static, so the browser makes
 * no request to Google at runtime - which is the only reason a webfont is
 * allowed here at all (s5: the browser talks to our own origin and nowhere
 * else). It is a build-time API, not a component, so nothing in this tree
 * becomes a client component and /login keeps its no-Providers, no-"use client"
 * render.
 *
 * `display: "swap"` because a staff tool must show its table before it shows it
 * prettily.
 *
 * These are wired into --font-sans / --font-mono in globals.css rather than
 * applied as classes, so every `font-sans` and `font-mono` already written in
 * this app picks them up with no call-site change, and the old system stack
 * stays behind them as the fallback a machine with no network still renders.
 *
 * Deliberately no `axes: ["opsz"]` and no `font-variation-settings: 'opsz' 32'`:
 * pinning Inter's optical size to a display value gives 10.5px table text
 * display-weight hairlines. Left alone, the axis tracks the font size by itself,
 * which is the entire point of having it.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      {/* min-h-svh, not min-h-screen: SidebarProvider one level down is already
          min-h-svh, and on a phone 100vh here against 100svh there is a few
          pixels of document scroll under a page that is meant to own the
          viewport. */}
      <body className="min-h-svh">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
