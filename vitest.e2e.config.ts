import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/e2e.test.ts"],
    globals: true,
  },
});
