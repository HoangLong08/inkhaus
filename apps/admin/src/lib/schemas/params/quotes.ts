import { z } from "zod";

import { quoteStatusSchema } from "../api";
import { pageParam } from "./common";

export const quotesQuerySchema = z.object({
  page: pageParam,
  status: quoteStatusSchema.optional().catch(undefined),
});

export type QuotesQuery = z.infer<typeof quotesQuerySchema>;
