import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only the server-side trust boundary. There is no component test setup
    // here, and pretending otherwise would make `pnpm test` a liability.
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
  },
});
