import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// fileURLToPath is given a string, not a URL: the mobile workspace pins
// TypeScript 6, whose lib URL type is not assignable to node's.
const here = dirname(fileURLToPath(import.meta.url));

/**
 * Vitest config for the mobile workspace.
 *
 * Two problems this solves, both of which used to present as mysterious
 * "Expected 'from', got 'typeOf'" parse errors:
 *
 *   1. **The `@/` alias.** It is declared only in tsconfig paths, which vitest
 *      does not read. The suite passed until now purely because every `@/`
 *      import in a test happened to be type-only, so esbuild erased it before
 *      resolution. The first value import through `@/` would have broken CI.
 *
 *   2. **Native modules.** Some Expo packages ship source vitest cannot parse
 *      and have no meaning outside the app runtime. They are aliased to stubs
 *      so a module graph that merely *touches* them stays loadable. Tests that
 *      assert on their behavior mock them explicitly instead.
 */
export default defineConfig({
  resolve: {
    alias: {
      "expo-secure-store": resolve(here, "test-stubs/expo-secure-store.ts"),
      "@": resolve(here, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
