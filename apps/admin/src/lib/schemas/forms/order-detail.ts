import {
  CARRIERS,
  ORDER_INTERNAL_NOTE_MAX,
  ORDER_NOTE_MAX,
  requiresTracking,
  TRACKING_NUMBER_PATTERN,
} from "@inkhaus/shared/orders";
import { z } from "zod";

import { orderStatusSchema } from "../api";

/**
 * Mutation input for the order detail page, shared by the form that collects
 * it and the route handler that receives it. One schema, so the client-side
 * message and the server-side refusal can never disagree about what a valid
 * note or tracking number is.
 *
 * Every limit is the shared constant the API validates with too. The status
 * note used to be 500 here and 300 in the API, so a 400-character note passed
 * this form and failed upstream with a message about a limit nobody could see.
 */

// ------------------------------------------------------------ route params

/**
 * The `[number]` segment, checked before it is put in an upstream path - the
 * same pattern as the API's OrderNumberParamsDto. A page answers "not found"
 * for anything else; a route handler answers 400.
 */
export const orderNumberParamSchema = z.object({
  number: z.string().regex(/^[A-Za-z0-9-]{1,32}$/, "That is not an order number."),
});

export const DESIGN_PREVIEW_SIDES = ["front", "back"] as const;

export type DesignPreviewSide = (typeof DESIGN_PREVIEW_SIDES)[number];

/** `/api/admin/designs/[publicId]/preview/[side]` - the API's DesignPublicIdParamsDto, plus a side */
export const designPreviewParamsSchema = z.object({
  publicId: z.string().regex(/^[A-Za-z0-9_-]{4,40}$/, "That is not a design id."),
  side: z.enum(DESIGN_PREVIEW_SIDES),
});

// ----------------------------------------------------------------- tracking

const TRACKING_NUMBER_MESSAGE = "A tracking number is 4 to 64 letters, digits, spaces or dashes.";

// Where tracking may be edited without a status move is `canEditTracking` in
// @inkhaus/shared/orders - the API refuses by it, the order page hides by it.

export const orderTrackingInputSchema = z.object({
  carrier: z.enum(CARRIERS, { message: "Pick the carrier." }),
  number: z.string().trim().regex(TRACKING_NUMBER_PATTERN, TRACKING_NUMBER_MESSAGE),
});

export type OrderTrackingInput = z.infer<typeof orderTrackingInputSchema>;

// ------------------------------------------------------------------- status

const statusNoteSchema = z
  .string()
  .trim()
  .max(ORDER_NOTE_MAX, `Keep the note to ${ORDER_NOTE_MAX} characters or fewer.`);

/** what `PATCH /api/admin/orders/:number/status` accepts */
export const orderStatusInputSchema = z.object({
  // The message is written for the form. A hand-made request that trips it gets
  // the same words, which is fine - it is still exactly what went wrong.
  status: z.enum(orderStatusSchema.options, { message: "Pick a status to move to." }),
  note: statusNoteSchema.optional(),
  /** required with SHIPPED unless the order already has tracking - the API decides */
  tracking: orderTrackingInputSchema.optional(),
});

export type OrderStatusInput = z.infer<typeof orderStatusInputSchema>;

/**
 * The status form itself. Flat, because a carrier Select and a number Input sit
 * beside the status and note, and only matter when the move needs them. The
 * rule for "needs them" depends on the order - SHIPPED without tracking already
 * on it - which is why this is a factory: the form rebuilds it each render with
 * what the cache says now.
 */
export function orderStatusFormSchema({ hasTracking }: { hasTracking: boolean }) {
  return z
    .object({
      status: z.enum(orderStatusSchema.options, { message: "Pick a status to move to." }),
      note: statusNoteSchema,
      carrier: z.enum(CARRIERS).optional(),
      trackingNumber: z.string(),
    })
    .superRefine((values, ctx) => {
      if (hasTracking || !requiresTracking(values.status)) return;

      if (!values.carrier) {
        ctx.addIssue({ code: "custom", path: ["carrier"], message: "Pick the carrier." });
      }
      const number = values.trackingNumber.trim();
      if (!TRACKING_NUMBER_PATTERN.test(number)) {
        ctx.addIssue({
          code: "custom",
          path: ["trackingNumber"],
          message: number ? TRACKING_NUMBER_MESSAGE : "Add the tracking number to ship this order.",
        });
      }
    });
}

export type OrderStatusFormValues = z.infer<ReturnType<typeof orderStatusFormSchema>>;

/** the form's flat values as the route handler wants them, tracking only when it is needed */
export function orderStatusInputFromForm(
  values: OrderStatusFormValues,
  { hasTracking }: { hasTracking: boolean },
): OrderStatusInput {
  const sendTracking = !hasTracking && requiresTracking(values.status) && values.carrier;
  return {
    status: values.status,
    ...(values.note ? { note: values.note } : {}),
    ...(sendTracking
      ? { tracking: { carrier: values.carrier!, number: values.trackingNumber.trim() } }
      : {}),
  };
}

// ------------------------------------------------------------ internal note

export const orderNoteInputSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, "Write the note first.")
    .max(ORDER_INTERNAL_NOTE_MAX, `Keep the note to ${ORDER_INTERNAL_NOTE_MAX} characters or fewer.`),
});

export type OrderNoteInput = z.infer<typeof orderNoteInputSchema>;
