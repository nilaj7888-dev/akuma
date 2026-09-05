import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // react-hooks v6 (via eslint-config-next core-web-vitals) ships the
      // React Compiler readiness rules. This app does not use the React
      // Compiler, and the standard "fetch on mount" pattern used across
      // ~15 dashboard/shop pages (an effect calling a named async loader
      // that eventually calls setState) trips this rule even though it is
      // one of React's own documented valid Effect uses. Adopting the
      // rule's real fix (a data-fetching library, or a wholesale rewrite
      // of every page's data flow) is out of scope for a lint cleanup and
      // carries real regression risk, so this rule is downgraded rather
      // than silently ignored. Revisit if/when this app adopts the React
      // Compiler or a fetching library like SWR/TanStack Query.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
