import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import uni from "@dcloudio/vite-plugin-uni";
import { blockWindowsOpenInEditor } from "./vite-security.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function requireMiniProgramApi(command: "build" | "serve", mode: string): void {
  const platform = process.env.UNI_PLATFORM;
  if (command !== "build" || mode !== "production" || !platform?.startsWith("mp-")) return;

  const fileEnv = loadEnv(mode, __dirname, "VITE_");
  const apiBase = process.env.VITE_API_BASE?.trim() || fileEnv.VITE_API_BASE?.trim();
  try {
    if (!apiBase || new URL(apiBase).protocol !== "https:") throw new Error();
  } catch {
    throw new Error(`${platform} 生产构建必须配置完整的 HTTPS VITE_API_BASE。`);
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  requireMiniProgramApi(command, mode);

  return {
    plugins: [blockWindowsOpenInEditor(), uni()],
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
