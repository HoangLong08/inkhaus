import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist/**", "coverage/**"]),
  ...tseslint.configs.recommended,
  {
    rules: {
      // Nest DTOs and Prisma payloads lean on `!` and inferred any in a few places
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);
