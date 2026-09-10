export const catalogKeys = {
  all: () => ["catalog"] as const,
  product: (slug: string) => ["catalog", "product", slug] as const,
  colors: () => ["catalog", "colors"] as const,
  sizes: () => ["catalog", "sizes"] as const,
  tiers: () => ["catalog", "tiers"] as const,
};
