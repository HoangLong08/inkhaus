/**
 * Which photographs to show for a blank in a given colourway.
 *
 * Photography is sparse by design: a shop rarely shoots all eight colourways of
 * a tee, and it never shoots the flat-lay detail shot twice. So a product's
 * images are a mix of colour-specific shots and colour-agnostic ones, and the
 * gallery is assembled per colourway rather than stored per colourway.
 *
 * Every function here returns `[]` rather than throwing when there is no
 * photography — the caller draws the SVG blank in that case.
 */
import type { Product, ProductImage } from "@/lib/catalog";

/**
 * The gallery for one colourway: its own shots first, then the shots that
 * belong to no particular colour.
 *
 * If that colourway was never photographed we fall back to the colour-agnostic
 * shots alone — showing a black tee's photo above a navy swatch would be a
 * worse lie than showing a folded-fabric detail.
 */
export function galleryFor(p: Product, colorKey: string): ProductImage[] {
  const images = p.images;
  if (!images?.length) return [];

  const agnostic = images.filter((i) => !i.color);
  const mine = images.filter((i) => i.color === colorKey);

  return mine.length ? [...mine, ...agnostic] : agnostic;
}

/**
 * Was *this* colourway actually photographed?
 *
 * The distinction matters for the lead image. A shop shoots two of eight
 * colourways and one flat-lay of the fabric; leading a navy tee with that
 * fabric shot tells the customer nothing about the navy tee. When the answer is
 * no, the caller shows the SVG blank in the right colour first and keeps the
 * colour-agnostic photos as supporting shots.
 */
export function hasColorPhoto(p: Product, colorKey: string): boolean {
  return Boolean(p.images?.some((i) => i.color === colorKey));
}

/**
 * The single shot a card should lead with, or null to draw the blank instead.
 *
 * Cards are small and shown next to their swatch row, so the same rule applies:
 * only a photo of the selected colourway earns the lead slot.
 */
export function heroImage(p: Product, colorKey: string): ProductImage | null {
  if (!hasColorPhoto(p, colorKey)) return null;
  return galleryFor(p, colorKey)[0] ?? null;
}

/** does this blank have any photography at all? */
export function hasPhotos(p: Product): boolean {
  return Boolean(p.images?.length);
}
