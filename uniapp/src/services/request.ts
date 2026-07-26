import type { ApiEnvelope } from "@lingdian/contracts";
import { customerAuth } from "./auth";
import { API_BASE, ASSET_BASE } from "../config/api";

type RequestMethod = NonNullable<UniApp.RequestOptions["method"]> | "PATCH";

type RequestConfig = Omit<UniApp.RequestOptions, "url" | "header" | "method"> & {
  header?: Record<string, string>;
  method?: RequestMethod;
  requiresAuth?: boolean;
};

class RequestError extends Error {
  constructor(message: string, readonly statusCode?: number) {
    super(message);
  }
}

export function resolveAssetUrl(url?: string | null) {
  if (!url) return "/static/products/milk-green.jpg";
  if (url.startsWith("http") || url.startsWith("/static")) return url;
  return `${ASSET_BASE}${url}`;
}

function redirectToLogin(): void {
  uni.reLaunch({ url: "/pages/auth/login" });
}

function requestOnce<T>(path: string, options: RequestConfig): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const { method, requiresAuth: _requiresAuth, ...requestOptions } = options;
    const token = customerAuth.getAccessToken();
    const header: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.header ?? {}),
    };
    if (token) header.Authorization = `Bearer ${token}`;

    uni.request({
      ...requestOptions,
      url: `${API_BASE}${path}`,
      method: method as UniApp.RequestOptions["method"],
      withCredentials: true,
      header,
      success(response) {
        const envelope = response.data as ApiEnvelope<T>;
        if (response.statusCode >= 200 && response.statusCode < 300 && envelope.code === 0) {
          resolve(envelope.data);
          return;
        }
        const message = response.statusCode === 401
          ? "登录状态已失效，请重新登录。"
          : toRequestMessage(envelope?.msg);
        reject(new RequestError(message, response.statusCode));
      },
      fail(error) {
        reject(new RequestError(toRequestMessage(error.errMsg, true)));
      },
    });
  });
}

export async function request<T>(path: string, options: RequestConfig = {}): Promise<T> {
  try {
    return await requestOnce<T>(path, options);
  } catch (error) {
    if (!(error instanceof RequestError) || error.statusCode !== 401) throw error;
    if (options.requiresAuth === false) {
      customerAuth.clear();
      throw error;
    }

    if (!(await customerAuth.refresh())) {
      redirectToLogin();
      throw error;
    }

    try {
      return await requestOnce<T>(path, options);
    } catch (retryError) {
      if (retryError instanceof RequestError && retryError.statusCode === 401) {
        customerAuth.clear();
        redirectToLogin();
      }
      throw retryError;
    }
  }
}

function toRequestMessage(message?: string, networkFailure = false): string {
  const source = message?.trim() ?? "";
  const normalized = source.toLowerCase();
  if (
    networkFailure ||
    normalized.includes("request:fail") ||
    normalized.includes("network request failed") ||
    normalized.includes("failed to fetch")
  ) {
    return "网络连接异常，请检查网络后重试。";
  }
  if (/[\u3400-\u9fff]/.test(source)) return source;
  if (normalized.includes("unauthorized")) return "当前内容暂时无法加载，请稍后重试。";
  return "请求失败，请稍后重试。";
}
