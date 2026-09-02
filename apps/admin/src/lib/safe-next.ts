/**
 * Only ever redirect to a path on this origin. "//evil.example" is a
 * protocol-relative URL that browsers treat as absolute, so checking for a
 * leading "/" alone is not enough - that is the classic open-redirect hole in a
 * `?next=` parameter.
 */
export function safeNext(value: string | null | undefined, fallback = "/") {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
