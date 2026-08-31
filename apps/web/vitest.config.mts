import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Node environment on purpose. These tests assert catalog *data* invariants —
 * unique slugs, print boxes inside the viewBox, size codes the API will accept,
 * image files that actually exist on disk. None of that needs a DOM, and the
 * browser-level behaviour is covered by the puppeteer scripts in `scripts/`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
