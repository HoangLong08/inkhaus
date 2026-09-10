import type { ReviewsQuery } from "@/lib/schemas/params";

export const reviewsKeys = {
  all: () => ["reviews"] as const,
  list: (params: ReviewsQuery) => ["reviews", "list", params] as const,
};
