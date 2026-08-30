import path from "node:path";
import { defineConfig } from "vitest/config";

// route.ts imports via the `@/*` alias declared in tsconfig.json's `paths`
// (`"@/*": ["./*"]`) — vitest doesn't read tsconfig paths on its own, so it's
// mirrored here.
export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
