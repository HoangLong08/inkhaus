import type { MetadataRoute } from "next";

// paper, not acid. --color-acid (#D8FF3E) is a fill colour - as a full-screen
// splash and an OS title bar it is punishing. #FCFCFA is --color-paper, which
// is what the page itself is painted with, so the seam disappears.
const PAPER = "#FCFCFA";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // set explicitly rather than defaulting to start_url, so changing start_url
    // later does not read as a different app and orphan everyone's install
    id: "/",
    name: "INKHAUS — Custom Apparel, Printed & Shipped in the USA",
    short_name: "INKHAUS",
    description:
      "Design your own tees, hoodies and headwear in the browser. No minimums. Printed in the USA, delivered in 3–5 days.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // no `orientation`: the studio is a canvas tool and landscape on a tablet
    // is a legitimate way to use it
    background_color: PAPER,
    theme_color: PAPER,
    categories: ["shopping", "business", "graphics"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Chrome only shows the richer install dialog when at least one screenshot
    // matches the form factor - wide is ignored on Android, narrow on desktop.
    screenshots: [
      {
        src: "/screenshots/wide-design.jpg",
        sizes: "1280x800",
        type: "image/jpeg",
        form_factor: "wide",
        label: "Design a garment in the browser",
      },
      {
        src: "/screenshots/wide-products.jpg",
        sizes: "1280x800",
        type: "image/jpeg",
        form_factor: "wide",
        label: "The catalogue",
      },
      {
        src: "/screenshots/narrow-design.jpg",
        sizes: "750x1334",
        type: "image/jpeg",
        form_factor: "narrow",
        label: "Design a garment in the browser",
      },
      {
        src: "/screenshots/narrow-home.jpg",
        sizes: "750x1334",
        type: "image/jpeg",
        form_factor: "narrow",
        label: "INKHAUS",
      },
    ],
    shortcuts: [
      { name: "Open the studio", short_name: "Studio", url: "/design" },
      { name: "Bulk quote", short_name: "Bulk", url: "/bulk" },
    ],
  };
}
