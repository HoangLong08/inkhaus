import { z } from "zod";

import { orderStatusSchema, quoteStatusSchema } from "./api";

/**
 * Mutation input, shared by the form that collects it and the route handler that
 * receives it. One schema, so the client-side message and the server-side refusal
 * can never disagree about what a valid note is.
 *
 * The 500-character limit used to exist only as `maxLength={500}` on an <input>,
 * which means it was enforced by the browser and by nothing else.
 */

export const orderStatusInputSchema = z.object({
  // The message is written for the form. A hand-made request that trips it gets
  // the same words, which is fine - it is still exactly what went wrong.
  status: z.enum(orderStatusSchema.options, { message: "Pick a status to move to." }),
  note: z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
});

export const quoteStatusInputSchema = z.object({
  status: quoteStatusSchema,
});

export type OrderStatusInput = z.infer<typeof orderStatusInputSchema>;
export type QuoteStatusInput = z.infer<typeof quoteStatusInputSchema>;
