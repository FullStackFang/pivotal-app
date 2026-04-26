import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    environment: "node",
    globals: false,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./") } },
});
