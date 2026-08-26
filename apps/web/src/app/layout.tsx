import type { Metadata, Viewport } from "next";
import { Anton, Inter_Tight, Instrument_Serif } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CartRoot from "@/components/cart/CartRoot";
import ServiceWorker from "@/components/pwa/ServiceWorker";
import OfflineBanner from "@/components/pwa/OfflineBanner";
import UpdateToast from "@/components/pwa/UpdateToast";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", display: "swap" });
const instrument = Instrument_Serif({ weight: "400", style: "italic", subsets: ["latin"], variable: "--font-instrument", display: "swap" });

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:4321");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "INKHAUS",
  title: "INKHAUS — Custom Apparel, Printed & Shipped in the USA",
  description:
    "Design your own tees, hoodies and headwear in the browser. No minimums. Printed in the USA, delivered in 3–5 days.",
  openGraph: {
    title: "INKHAUS — Custom Apparel Printed in the USA",
    description: "Design it. We print it. Ships in 3–5 days.",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "INKHAUS",
  },
  // phone numbers in the pricing copy were being auto-linked by iOS
  formatDetection: { telephone: false },
};

// Next 16 rejects themeColor inside `metadata` - it belongs to the viewport
// export. viewportFit is deliberately left at its default: the layout leans on
// min-h-[100svh] and a sticky --nav-h header, and "cover" would push both under
// the notch until globals.css grows safe-area insets.
export const viewport: Viewport = {
  themeColor: "#FCFCFA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${anton.variable} ${interTight.variable} ${instrument.variable}`}
    >
      <body className="grain antialiased">
        <ServiceWorker>
          <OfflineBanner />
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
          <CartRoot />
          <UpdateToast />
        </ServiceWorker>
      </body>
    </html>
  );
}
