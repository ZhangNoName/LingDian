import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { normalizeApiBase } from "./api-base";
import { miniappIconImages } from "./miniapp-icon-images";
import uni from "@dcloudio/vite-plugin-uni";
import { blockWindowsOpenInEditor } from "./vite-security.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "VITE_");
  const apiBase = normalizeApiBase(process.env.VITE_API_BASE ?? env.VITE_API_BASE, process.env.NODE_ENV === "production", process.env.UNI_PLATFORM);
  return {
    define: { __LINGDIAN_API_BASE__: JSON.stringify(apiBase) },
    plugins: [blockWindowsOpenInEditor(), miniappIconImages(), uni()],
    server: {
      host: "127.0.0.1",
    },
    resolve: {
      alias: {
        "@theme": path.resolve(__dirname, "../theme"),
      },
    },
  };
});
