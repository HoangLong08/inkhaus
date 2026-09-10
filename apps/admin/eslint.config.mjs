import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  // `.next-e2e` is the suite's build dir, generated output like `.next` itself
  globalIgnores([".next/**", ".next-e2e/**", "out/**", "build/**", "next-env.d.ts"]),

  {
    // shadcn CLI output. `npx shadcn@latest add` regenerates these verbatim, so
    // any fix we made here would be undone by the next add and any error left
    // here would block every lint run until then. The React Compiler rules in
    // particular flag patterns upstream has chosen deliberately (use-mobile's
    // media-query sync, sidebar.tsx reading document.cookie during render).
    //
    // This is not a licence to put our own code in these paths - see AGENTS.md.
    files: ["src/components/ui/**", "src/hooks/use-mobile.ts"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
    },
  },

  {
    // The BFF client is a plain module, not a component, so there is no router
    // to reach for - and a hard navigation is what we want here anyway. See the
    // comment at the call site.
    files: ["src/lib/client-api.ts"],
    rules: {
      "@next/next/no-location-assign-relative-destination": "off",
    },
  },
]);
