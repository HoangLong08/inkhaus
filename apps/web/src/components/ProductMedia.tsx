"use client";

import Image from "next/image";
import Garment from "@/components/Garment";
import type { GarmentType, ProductImage } from "@/lib/catalog";

/**
 * One product visual: the photograph when there is one, the SVG blank when
 * there is not.
 *
 * This is the only place `next/image` is used for the catalog. Two reasons to
 * keep it that way — every optimizer setting stays in one file, and the studio
 * must keep rendering `<Garment>` directly, because `renderMockup()` clones the
 * live `<svg>` node out of the DOM and would find an `<img>` there instead.
 *
 * Photo and fallback share the same aspect box so swapping between them, or
 * loading a photo late, never moves the layout.
 */
export const SIZES_CARD = "(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw";
export const SIZES_HERO = "(min-width: 1024px) 46vw, 100vw";

export default function ProductMedia({
  image,
  type,
  color,
  className = "",
  sizes = SIZES_CARD,
  /** the LCP image on a page — one per route, at most */
  preload = false,
  printArea,
  showPrintGuide = false,
  children,
}: {
  image?: ProductImage | null;
  type: GarmentType;
  color: string;
  className?: string;
  sizes?: string;
  preload?: boolean;
  printArea?: { x: number; y: number; w: number; h: number };
  showPrintGuide?: boolean;
  children?: React.ReactNode;
}) {
  if (image) {
    return (
      <Image
        src={image.src}
        alt={image.alt}
        width={image.w}
        height={image.h}
        sizes={sizes}
        // `priority` is deprecated in Next 16 — `preload` says what it does
        preload={preload}
        className={`h-full w-full object-contain ${className}`}
      />
    );
  }

  return (
    <Garment
      type={type}
      color={color}
      className={className}
      printArea={printArea}
      showPrintGuide={showPrintGuide}
    >
      {children}
    </Garment>
  );
}
