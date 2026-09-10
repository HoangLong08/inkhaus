import type { OrdersQuery } from "@/lib/schemas/params";

export const ordersKeys = {
  all: () => ["orders"] as const,
  list: (params: OrdersQuery) => ["orders", "list", params] as const,
  detail: (number: string) => ["orders", "detail", number] as const,
};
