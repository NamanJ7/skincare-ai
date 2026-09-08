import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Mirror the "@/*" path alias from tsconfig.json so tests import the same way
  // the route handlers do.
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: { include: ["lib/**/*.test.ts"] },
});
