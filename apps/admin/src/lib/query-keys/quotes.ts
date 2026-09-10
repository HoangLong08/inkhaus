import type { QuotesQuery } from "@/lib/schemas/params";

export const quotesKeys = {
  all: () => ["quotes"] as const,
  list: (params: QuotesQuery) => ["quotes", "list", params] as const,
  detail: (id: string) => ["quotes", "detail", id] as const,
};
