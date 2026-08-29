const DEVELOPMENT_API_BASE = "http://localhost:9000/api";
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Normalizes the only public API endpoint accepted by the mini program.
 * Keeping this rule here prevents every service from inventing its own URL
 * concatenation and makes a future gateway/protocol replacement local.
 */
export function normalizeApiBase(value?: string): string {
  const candidate = value?.trim() || DEVELOPMENT_API_BASE;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("VITE_API_BASE 必须是完整的 HTTP(S) 地址。");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("VITE_API_BASE 只支持 HTTP(S) 协议。");
  }
  if (import.meta.env.PROD && url.protocol !== "https:") {
    throw new Error("生产环境 VITE_API_BASE 必须使用 HTTPS。");
  }
  url.pathname = url.pathname.replace(/\/+$/, "") || "/api";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function readTimeout(value?: string): number {
  if (!value) return DEFAULT_TIMEOUT_MS;
  const timeout = Number(value);
  if (!Number.isInteger(timeout) || timeout < 1_000 || timeout > 60_000) {
    throw new Error("VITE_API_TIMEOUT_MS 必须是 1000 到 60000 之间的整数。");
  }
  return timeout;
}

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE);
export const API_TIMEOUT_MS = readTimeout(import.meta.env.VITE_API_TIMEOUT_MS);
export const ASSET_BASE = API_BASE.replace(/\/api(?:\/v\d+)?$/, "");

export function buildApiUrl(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("API path 必须是以单个 / 开头的相对路径。");
  }
  return `${API_BASE}${path}`;
}

export function buildAssetUrl(path: string): string {
  if (/^https?:\/\//i.test(path) || path.startsWith("/static/")) return path;
  return `${ASSET_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}
