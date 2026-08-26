import type { Metadata } from "next";
import { Anton, Inter_Tight, Instrument_Serif } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", display: "swap" });
const instrument = Instrument_Serif({ weight: "400", style: "italic", subsets: ["latin"], variable: "--font-instrument", display: "swap" });

export const metadata: Metadata = {
  title: "INKHAUS — Custom Apparel, Printed & Shipped in the USA",
  description:
    "Design your own tees, hoodies and headwear in the browser. No minimums. Printed in the USA, delivered in 3–5 days.",
  openGraph: {
    title: "INKHAUS — Custom Apparel Printed in the USA",
    description: "Design it. We print it. Ships in 3–5 days.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${anton.variable} ${interTight.variable} ${instrument.variable}`}
    >
      <body className="grain antialiased">
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
