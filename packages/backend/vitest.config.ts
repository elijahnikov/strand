import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    server: { deps: { inline: ["convex-test"] } },
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
  },
});
