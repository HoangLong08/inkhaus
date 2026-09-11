import { QUOTE_NOTE_MAX } from "@inkhaus/shared/orders";
import { PRINT_METHODS } from "@inkhaus/shared/taxonomy";
import { z } from "zod";

import { quoteStatusSchema } from "../api";
import { isoDayParam, quoteIdSchema } from "../params";

/**
 * The triage fields - any of the three, sent on their own by the control that
 * changed them. `undefined` leaves a field alone; `null` clears it.
 */
export const quoteUpdateInputSchema = z
  .object({
    status: quoteStatusSchema.optional(),
    assigneeId: quoteIdSchema.nullable().optional(),
    // isoDayParam's own `.catch()` would turn a bad day into "no change";
    // a mutation should refuse it instead, so the day is checked here directly
    followUpAt: z
      .string()
      .refine((day) => isoDayParam.parse(day) === day, "Pick a real day.")
      .nullable()
      .optional(),
  })
  .refine(
    (input) =>
      input.status !== undefined || input.assigneeId !== undefined || input.followUpAt !== undefined,
    "Nothing to change.",
  );

export type QuoteUpdateInput = z.infer<typeof quoteUpdateInputSchema>;

export const quoteNoteInputSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, "Write a note first.")
    .max(QUOTE_NOTE_MAX, `Keep it under ${QUOTE_NOTE_MAX} characters.`),
});

export type QuoteNoteInput = z.infer<typeof quoteNoteInputSchema>;

export const CONVERT_NOTES_MAX = 1000;
/** the API's cap on one order line's sizes */
export const CONVERT_SIZES_MAX = 20;

const sizeLine = z.object({
  size: z.string().min(1).max(8),
  qty: z
    .number({ error: "Enter a whole number." })
    .int("Enter a whole number.")
    .min(0, "A quantity cannot be negative.")
    .max(100_000, "That is more than one order can hold."),
});

/**
 * The convert dialog. The form holds the product's whole size run, zeros
 * included, because that is the grid on screen; what leaves it - and what the
 * route handler accepts - is only the sizes with a quantity, each once. One
 * schema for both, so the dialog cannot submit something the server refuses
 * for a reason the dialog never showed.
 */
export const quoteConvertInputSchema = z.object({
  productSlug: z.string().min(1, "Pick a product."),
  colorSlug: z.string().min(1, "Pick a colour."),
  // a string going in, so choosing another product can empty the field back
  // to its placeholder; one of the API's methods coming out
  method: z.string().min(1, "Pick a print method.").pipe(z.enum(PRINT_METHODS)),
  sizes: z
    .array(sizeLine)
    .transform((lines) => lines.filter((line) => line.qty > 0))
    .pipe(
      z
        .array(sizeLine.extend({ qty: sizeLine.shape.qty.min(1) }))
        .min(1, "Enter a quantity for at least one size.")
        .max(CONVERT_SIZES_MAX)
        .refine(
          (lines) => new Set(lines.map((line) => line.size)).size === lines.length,
          "Each size may appear only once.",
        ),
    ),
  notes: z
    .string()
    .trim()
    .max(CONVERT_NOTES_MAX, `Keep it under ${CONVERT_NOTES_MAX} characters.`)
    .optional()
    .transform((notes) => notes || undefined),
});

/** what the dialog's fields hold */
export type QuoteConvertFormValues = z.input<typeof quoteConvertInputSchema>;
/** what is sent, and what the route handler receives */
export type QuoteConvertInput = z.output<typeof quoteConvertInputSchema>;
