import { expect, test } from "@playwright/test";

import { LOGIN_RATE_LIMIT } from "../playwright.config";
import { API_ORIGIN } from "./helpers";

/**
 * In its own file, named to sort last: this test deliberately exhausts the
 * sign-in window, and anything running after it would be throttled out.
 *
 * It exists because the suite raises ADMIN_LOGIN_RATE_LIMIT well above the
 * production default of 10 - a browser test signing in twenty times is not an
 * attack. Reading the same number back means that convenience cannot quietly
 * delete the coverage.
 */
test("the sign-in endpoint is rate limited", async () => {
  const budget = LOGIN_RATE_LIMIT;
  let attempts = 0;
  let throttled = false;

  while (attempts < budget + 5) {
    attempts++;
    const res = await fetch(`${API_ORIGIN}/admin/auth/google`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // long enough to satisfy the DTO, nonsense to the verifier - we are
      // measuring the gate in front, not what is behind it
      body: JSON.stringify({ idToken: "not-a-real-token-but-long-enough-to-pass" }),
    });

    if (res.status === 429) {
      throttled = true;
      break;
    }
    // anything else must be a refusal, never a session
    expect(res.status, "a garbage token must never be accepted").toBe(401);
  }

  expect(throttled, `no 429 within ${budget + 5} attempts`).toBe(true);
});
