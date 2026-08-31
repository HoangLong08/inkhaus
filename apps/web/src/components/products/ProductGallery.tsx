"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Ruler } from "lucide-react";
import Garment from "@/components/Garment";
import ProductMedia, { SIZES_HERO } from "@/components/ProductMedia";
import Modal from "@/components/ui/Modal";
import type { Colorway, Product } from "@/lib/catalog";
import { galleryFor, hasColorPhoto } from "@/lib/productImages";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The product-page visual: a photo carousel when there is photography, and the
 * SVG blank with its print guide when there is not.
 *
 * The print-guide view is never dropped — it is the thing that tells a customer
 * what will actually fit on the blank — so with photos present it becomes the
 * last thumbnail rather than disappearing.
 */
export default function ProductGallery(props: {
  product: Product;
  color: Colorway;
  colorKey: string;
}) {
  // A different colourway is a different set of photos, so index 2 of the old
  // set means nothing in the new one. Remounting on the key is React's own
  // answer to "reset state when a prop changes" — cleaner than an effect that
  // fires a render late.
  return <Gallery key={props.colorKey} {...props} />;
}

function Gallery({
  product,
  color,
  colorKey,
}: {
  product: Product;
  color: Colorway;
  colorKey: string;
}) {
  const photos = useMemo(() => galleryFor(product, colorKey), [product, colorKey]);
  const [i, setI] = useState(0);
  // lead with the blank whenever this colourway has no photo of its own — a
  // fabric flat-lay above a "Colour — Navy" label is not a picture of the navy
  const [box, setBox] = useState(!hasColorPhoto(product, colorKey));
  const [zoom, setZoom] = useState(false);

  const count = photos.length;
  const showingBox = box || count === 0;
  const current = showingBox ? null : photos[Math.min(i, count - 1)];

  const step = (d: number) => {
    if (count === 0) return;
    setBox(false);
    setI((v) => (v + d + count) % count);
  };

  useEffect(() => {
    if (count < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (zoom) return; // the lightbox owns the arrows while it is open
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div data-testid="pdp-gallery">
      <div className="group relative overflow-hidden rounded-3xl border hairline bg-[radial-gradient(ellipse_at_50%_0%,#ffffff,#eceee7)] p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={showingBox ? `box-${color.hex}` : current!.src}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
            className={count > 0 && !showingBox ? "cursor-zoom-in" : ""}
            onClick={() => count > 0 && !showingBox && setZoom(true)}
          >
            <ProductMedia
              image={current}
              type={product.type}
              color={color.hex}
              sizes={SIZES_HERO}
              preload
              printArea={showingBox ? product.printArea : undefined}
              showPrintGuide={showingBox}
              className="w-full drop-shadow-[0_24px_48px_rgba(22,23,27,0.18)]"
            />
          </motion.div>
        </AnimatePresence>

        {count > 1 && (
          <>
            <Arrow side="left" onClick={() => step(-1)} />
            <Arrow side="right" onClick={() => step(1)} />
          </>
        )}

        {showingBox && (
          <span className="absolute bottom-6 left-6 rounded-full border hairline bg-paper/80 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-ink/60 backdrop-blur">
            Print area {product.printInches.w}&quot; × {product.printInches.h}&quot;
          </span>
        )}
      </div>

      {count > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {photos.map((img, idx) => (
            <button
              key={img.src}
              type="button"
              data-testid="pdp-gallery-thumb"
              onClick={() => {
                setBox(false);
                setI(idx);
              }}
              aria-label={img.alt}
              aria-pressed={!showingBox && idx === i}
              className={`relative h-24 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-paper-2 transition ${
                !showingBox && idx === i ? "border-acid-2" : "border-transparent hover:border-ink/20"
              }`}
            >
              <Image
                src={img.src}
                alt=""
                width={img.w}
                height={img.h}
                sizes="80px"
                className="h-full w-full object-cover"
              />
            </button>
          ))}

          {/* the print guide keeps a seat at the table once photos exist */}
          <button
            type="button"
            data-testid="pdp-gallery-thumb"
            onClick={() => setBox(true)}
            aria-label="Show the print area"
            aria-pressed={showingBox}
            className={`relative grid h-24 w-20 shrink-0 place-items-center rounded-xl border-2 bg-paper-2 transition ${
              showingBox ? "border-acid-2" : "border-transparent hover:border-ink/20"
            }`}
          >
            <Garment type={product.type} color={color.hex} className="absolute inset-0 h-full w-full opacity-30" />
            <span className="relative flex flex-col items-center gap-1 text-[9px] font-bold uppercase tracking-[0.1em] text-ink/60">
              <Ruler size={14} className="text-acid-2" />
              Print area
            </span>
          </button>
        </div>
      )}

      <Modal
        open={zoom}
        onClose={() => setZoom(false)}
        label={current?.alt ?? product.name}
        testid="pdp-lightbox"
        bare
        className="max-w-5xl"
      >
        {current && (
          <div className="relative rounded-2xl bg-paper p-2">
            <Image
              // the 2x master when one was downloaded — this is the one view
              // that is worth the extra bytes
              src={current.src2x ?? current.src}
              alt={current.alt}
              // the base dimensions on purpose: next/image only uses these for
              // the aspect box, and the 2x file is the same photo at a larger
              // size, not a different crop. Doubling them would be a guess
              // about the master's real pixels.
              width={current.w}
              height={current.h}
              sizes="100vw"
              className="h-auto w-full rounded-xl object-contain"
            />
            {count > 1 && (
              <div className="mt-2 flex items-center justify-center gap-3">
                <Arrow side="static" onClick={() => step(-1)} />
                <span className="text-[12px] tabular-nums text-ink/50">
                  {i + 1} / {count}
                </span>
                <Arrow side="static" onClick={() => step(1)} flip />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Arrow({
  side,
  onClick,
  flip,
}: {
  side: "left" | "right" | "static";
  onClick: () => void;
  flip?: boolean;
}) {
  const positioned =
    side === "left"
      ? "absolute left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100"
      : side === "right"
        ? "absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100"
        : "";
  const Icon = side === "right" || flip ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={side === "right" || flip ? "Next image" : "Previous image"}
      className={`grid h-10 w-10 place-items-center rounded-full border hairline bg-paper/90 text-ink/70 backdrop-blur transition hover:text-ink ${positioned}`}
    >
      <Icon size={18} />
    </button>
  );
}
