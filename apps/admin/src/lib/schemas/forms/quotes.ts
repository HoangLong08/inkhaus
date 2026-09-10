import { z } from "zod";

import { quoteStatusSchema } from "../api";

export const quoteStatusInputSchema = z.object({
  status: quoteStatusSchema,
});

export type QuoteStatusInput = z.infer<typeof quoteStatusInputSchema>;
