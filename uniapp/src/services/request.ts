import { getDemoToken } from "./auth";

const API_BASE = "http://localhost:3000/api";
const ASSET_BASE = API_BASE.replace(/\/api$/, "");

type ApiEnvelope<T> = {
  code: number;
  msg: string;
  data: T;
};

type RequestConfig = Omit<UniApp.RequestOptions, "url">;

export function resolveAssetUrl(url?: string | null) {
  if (!url) return "/static/products/milk-green.jpg";
  if (url.startsWith("http") || url.startsWith("/static")) return url;
  return `${ASSET_BASE}${url}`;
}

export function request<T>(path: string, options: RequestConfig = {}) {
  return new Promise<T>((resolve, reject) => {
    uni.request({
      ...options,
      url: `${API_BASE}${path}`,
      header: {
        Authorization: `Bearer ${getDemoToken()}`,
        "Content-Type": "application/json",
        ...(options.header ?? {}),
      },
      success(response) {
        const envelope = response.data as ApiEnvelope<T>;
        if (response.statusCode >= 200 && response.statusCode < 300 && envelope.code === 0) {
          resolve(envelope.data);
          return;
        }
        reject(new Error(envelope?.msg || "请求失败"));
      },
      fail(error) {
        reject(new Error(error.errMsg || "网络请求失败"));
      },
    });
  });
}
