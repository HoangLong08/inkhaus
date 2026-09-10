import { ORDER_NOTE_MAX } from "@inkhaus/shared/orders";
import { z } from "zod";

import { orderStatusSchema } from "../api";

/**
 * Mutation input, shared by the form that collects it and the route handler that
 * receives it. One schema, so the client-side message and the server-side refusal
 * can never disagree about what a valid note is.
 *
 * The limit is the shared constant the API validates with too. It used to be 500
 * here and 300 in the API, so a 400-character note passed this form and failed
 * upstream with a message about a limit nobody could see.
 */
export const orderStatusInputSchema = z.object({
  // The message is written for the form. A hand-made request that trips it gets
  // the same words, which is fine - it is still exactly what went wrong.
  status: z.enum(orderStatusSchema.options, { message: "Pick a status to move to." }),
  note: z
    .string()
    .trim()
    .max(ORDER_NOTE_MAX, `Keep the note to ${ORDER_NOTE_MAX} characters or fewer.`)
    .optional(),
});

export type OrderStatusInput = z.infer<typeof orderStatusInputSchema>;
