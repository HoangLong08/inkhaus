import type { Messages } from "./messages";

/**
 * Why a sign-in failed, as a code rather than a sentence.
 *
 * The OAuth route handlers put one of these in `/login?error=…` and the login
 * page looks it up in `Login.errors`. That split exists because /login is
 * translated and a page cannot translate a sentence it was handed pre-baked -
 * the same reason @inkhaus/shared/admin pairs a `code` with its `message`.
 *
 * The type is derived from the catalogue, so a code with no translation is a
 * typecheck failure rather than a raw "NOT_ALLOWED" rendered at an operator.
 */
export type LoginErrorCode = keyof Messages["Login"]["errors"];

/**
 * The same list at runtime, for validating a hand-typed or bookmarked URL.
 * `satisfies` is what ties it to the catalogue: a name that is not a key there
 * does not compile.
 */
export const LOGIN_ERROR_CODES = [
  "CANCELLED",
  "EXPIRED",
  "NO_CODE",
  "EXCHANGE",
  "NOT_ALLOWED",
  "UNREACHABLE",
  "RATE_LIMITED",
  "NOT_CONFIGURED",
  "UNKNOWN",
] as const satisfies readonly LoginErrorCode[];

/** anything unrecognised is UNKNOWN, which still says something useful */
export function loginErrorCode(value: string | undefined): LoginErrorCode | null {
  if (!value) return null;
  return LOGIN_ERROR_CODES.find((code) => code === value) ?? "UNKNOWN";
}
