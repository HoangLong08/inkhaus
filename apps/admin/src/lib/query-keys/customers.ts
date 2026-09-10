export const customersKeys = {
  all: () => ["customers"] as const,
  detail: (id: string) => ["customers", "detail", id] as const,
};
