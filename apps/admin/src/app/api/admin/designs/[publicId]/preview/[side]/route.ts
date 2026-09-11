import { adminApi } from "@/lib/api";
import { HttpError, requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { designPreviewParamsSchema } from "@/lib/schemas/forms";

/**
 * The only image types this route will serve, as a base64 data URL - the same
 * three the API's PREVIEWABLE_IMAGE_PREFIXES reports as drawable. Anything else
 * (an SVG above all, which is a document that can run script) is answered as
 * "no preview" rather than passed through.
 */
const IMAGE_DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

/**
 * One side of a design's mockup, as an image the page can put in an `<img>`.
 *
 * The API stores previews as data URLs. Inlining one into the page would
 * serialise megabytes of base64 into the server render and again into the
 * hydration payload; decoding it here gives the browser a same-origin image it
 * can cache for a few minutes, fetched with the session cookie like any other
 * BFF call. `private`: it is a customer's artwork behind a sign-in, and no
 * shared cache may keep it.
 */
export const GET = route(
  async (
    _request: Request,
    ctx: { params: Promise<{ publicId: string; side: string }> },
  ) => {
    await requireCapability("orders.view");
    const { publicId, side } = designPreviewParamsSchema.parse(await ctx.params);

    const design = await adminApi.order.designPreview(publicId);
    const dataUrl = side === "front" ? design.previewFront : design.previewBack;
    const match = dataUrl ? IMAGE_DATA_URL.exec(dataUrl) : null;
    if (!match) throw new HttpError(404, `This design has no ${side} preview.`);

    const [, contentType, base64] = match;
    const bytes = new Uint8Array(Buffer.from(base64, "base64"));

    return new Response(bytes, {
      headers: {
        "content-type": contentType,
        "content-length": String(bytes.byteLength),
        "cache-control": "private, max-age=300",
        // the type above is the whole truth; never let a browser guess another
        "x-content-type-options": "nosniff",
      },
    });
  },
);
