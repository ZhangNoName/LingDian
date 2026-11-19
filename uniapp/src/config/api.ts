const DEFAULT_TIMEOUT_MS = 15_000;

function readTimeout(value?: string): number {
  if (!value) return DEFAULT_TIMEOUT_MS;
  const timeout = Number(value);
  if (!Number.isInteger(timeout) || timeout < 1_000 || timeout > 60_000) {
    throw new Error("VITE_API_TIMEOUT_MS 必须是 1000 到 60000 之间的整数。");
  }
  return timeout;
}

export const API_BASE = __LINGDIAN_API_BASE__;
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
