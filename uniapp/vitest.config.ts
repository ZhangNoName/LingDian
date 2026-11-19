import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeApiBase } from "./api-base";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  define: { __LINGDIAN_API_BASE__: JSON.stringify(normalizeApiBase(process.env.VITE_API_BASE, false)) },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
    setupFiles: ["./tests/setup-uni.ts"],
  },
});
