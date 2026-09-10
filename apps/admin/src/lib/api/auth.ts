import { adminUserSchema, okSchema, sessionSchema } from "@/lib/schemas/api";

import { request } from "./core";

/** FROZEN after Phase 0. */
export const authApi = {
  /**
   * Hands Google's id_token to the API, which verifies its signature against
   * Google's JWKS itself. The admin app is never trusted to vouch for an
   * identity - it only drives the browser end of the flow.
   */
  loginWithGoogle: (idToken: string) =>
    request("/admin/auth/google", {
      method: "POST",
      body: { idToken },
      // no session cookie exists yet at this point
      token: "",
      schema: sessionSchema,
    }),

  me: (token?: string) => request("/admin/auth/me", { token, schema: adminUserSchema }),

  logout: () => request("/admin/auth/logout", { method: "POST", schema: okSchema }),
};
