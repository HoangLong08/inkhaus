import type { AdminOrderDetailItem } from "@/lib/schemas/api";
import { DESIGN_PREVIEW_SIDES } from "@/lib/schemas/forms";

/**
 * The artwork on one order line, drawn through the same-origin preview route:
 * the API keeps previews as data URLs, and the route decodes one side into an
 * image the browser can cache. Only the sides the API says it can serve are
 * drawn, so a design saved without a back shows one image rather than a broken
 * second one.
 */
export default function DesignPreview({ design }: { design: AdminOrderDetailItem["design"] }) {
  if (!design) {
    return <p className="text-muted-foreground text-xs">Blank — no artwork on this line.</p>;
  }

  const sides = DESIGN_PREVIEW_SIDES.filter((side) =>
    side === "front" ? design.hasFront : design.hasBack,
  );

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">
        Artwork <span className="text-foreground font-medium">{design.name}</span> ·{" "}
        <span className="font-mono">{design.publicId}</span>
      </p>

      {sides.length === 0 ? (
        <p className="text-muted-foreground text-xs">No preview was saved with this design.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {sides.map((side) => (
            <figure key={side} className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- same-origin BFF image; this app runs no image optimizer */}
              <img
                src={`/api/admin/designs/${encodeURIComponent(design.publicId)}/preview/${side}`}
                alt={`${design.name}, ${side}`}
                width={128}
                height={128}
                decoding="async"
                className="bg-muted size-32 rounded-md border object-contain"
                data-testid="design-preview"
                data-design={design.publicId}
                data-side={side}
              />
              <figcaption className="text-muted-foreground text-xs capitalize">{side}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
