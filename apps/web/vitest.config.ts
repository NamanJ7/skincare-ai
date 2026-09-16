import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Mirror the "@/*" path alias from tsconfig.json so tests import the same way
  // the route handlers do.
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    // Only the server-side trust boundary. There is no component test setup
    // here, and pretending otherwise would make `pnpm test` a liability.
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
  },
});
