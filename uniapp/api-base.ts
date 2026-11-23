const DEVELOPMENT_API_BASE = "http://localhost:9000/api";

export function normalizeApiBase(value: string | undefined, production: boolean, platform?: string): string {
  const configured = value?.trim();
  if (!configured && production) {
    if (platform?.startsWith("mp-")) throw new Error(`${platform} 生产构建必须配置完整的 HTTPS VITE_API_BASE。`);
    return "/api";
  }

  const candidate = configured || DEVELOPMENT_API_BASE;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("VITE_API_BASE 必须是完整的 HTTP(S) 地址。");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("VITE_API_BASE 只支持 HTTP(S) 协议。");
  }
  if (production && url.protocol !== "https:") {
    throw new Error("生产环境 VITE_API_BASE 必须使用 HTTPS。");
  }
  url.pathname = url.pathname.replace(/\/+$/, "") || "/api";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}
