import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// The pure scan modules (and their tests) moved to @pore/shared/scan; what
// remains in lib/ is browser I/O covered by manual testing. The api/ pattern
// covers the route handlers, where the abuse controls for the paid analysis
// path are asserted — node environment, no jsdom.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: [
      "lib/**/__tests__/**/*.test.ts",
      "app/api/**/__tests__/**/*.test.ts",
    ],
    // Deliberately NOT passWithNoTests: a typo in the globs above would
    // otherwise turn the entire security suite green while running nothing.
  },
});
