import type { OverviewQuery } from "@/lib/schemas/params";

export const statsKeys = {
  all: () => ["stats"] as const,
  overview: (params: OverviewQuery) => ["stats", "overview", params] as const,
};
