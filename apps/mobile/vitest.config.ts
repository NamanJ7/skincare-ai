import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

/**
 * The mobile app had no test runner, which is how a restart could silently turn
 * the pregnancy safety filter off without anything going red. The engines in
 * packages/shared were always well tested; the state feeding them was not
 * tested at all.
 *
 * expo-file-system is aliased to a small in-memory stand-in so the journal's
 * read/write logic can be exercised in plain Node. See src/test/expo-file-system.ts.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "expo-file-system": resolve(__dirname, "src/test/expo-file-system.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
