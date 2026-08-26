"use client";

import Garment from "@/components/Garment";
import type { ResolvedLine } from "@/lib/cart";

/**
 * A customised line shows the mockup the studio rendered; a blank falls back to
 * the same live garment SVG the rest of the site draws, tinted to its colourway.
 *
 * The mockup is a data-url, so `next/image` has nothing to optimise and a plain
 * <img> is the honest element here.
 */
export default function LineThumb({
  line,
  className = "",
}: {
  line: ResolvedLine;
  className?: string;
}) {
  const label = `${line.product.name} in ${line.color.name}`;

  return (
    <div
      className={`grid shrink-0 place-items-center overflow-hidden rounded-xl border hairline bg-paper-2 ${className}`}
    >
      {line.design?.preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={line.design.preview}
          alt={`Your design on the ${label}`}
          className="h-full w-full object-contain"
        />
      ) : (
        <Garment type={line.product.type} color={line.color.hex} className="h-full w-full" />
      )}
    </div>
  );
}
