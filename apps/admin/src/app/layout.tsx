import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "INKHAUS Back Office",
  description: "Order production and bulk quote triage.",
  // belt and braces alongside robots.ts - this app should never be indexed
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
