import { customerAuth } from "./auth";
import { buildAssetUrl } from "../config/api";
import { usesBrowserCookieTransport } from "@/config/platform";
import { ApiError, NetworkError, requestApiEnvelope, type HttpMethod } from "@/infra/http/uni-http-client";

type RequestConfig = Omit<UniApp.RequestOptions, "url" | "header" | "method"> & {
  header?: Record<string, string>;
  method?: HttpMethod;
  requiresAuth?: boolean;
};

export class RequestError extends Error {
  constructor(message: string, readonly statusCode?: number) {
    super(message);
  }
}

export function resolveAssetUrl(url?: string | null) {
  if (!url) return "/static/products/milk-green.jpg";
  return buildAssetUrl(url);
}

function redirectToLogin(): void {
  uni.reLaunch({ url: "/pages/auth/login" });
}

function requestOnce<T>(path: string, options: RequestConfig): Promise<T> {
  const { method, requiresAuth: _requiresAuth, header: customHeader, ...requestOptions } = options;
  const token = options.requiresAuth === false ? undefined : customerAuth.getAccessToken();
  return requestApiEnvelope<T>({
    ...requestOptions,
    path,
    method,
    header: {
      ...(customHeader ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }).catch((error: unknown) => {
    if (error instanceof NetworkError) {
      throw new RequestError(toRequestMessage(error.causeMessage, true));
    }
    if (error instanceof ApiError) {
      throw new RequestError(
        error.statusCode === 401
          ? "登录状态已失效，请重新登录。"
          : toRequestMessage(error.message),
        error.statusCode,
      );
    }
    throw error;
  });
}

export async function request<T>(path: string, options: RequestConfig = {}): Promise<T> {
  const sentAccessToken = options.requiresAuth === false ? undefined : customerAuth.getAccessToken();
  try {
    return await requestOnce<T>(path, options);
  } catch (error) {
    if (!(error instanceof RequestError) || error.statusCode !== 401) throw error;
    if (options.requiresAuth === false) {
      throw error;
    }

    // A native 401 received for a token that was locally still valid is a
    // server-side rejection, not ordinary expiry. Do not silently undo logout,
    // revoke-all, or a security intervention with provider reauthentication.
    if (sentAccessToken && !usesBrowserCookieTransport()) {
      customerAuth.blockAutomaticRecovery();
    }

    if (!(await customerAuth.refresh())) {
      redirectToLogin();
      throw error;
    }

    try {
      return await requestOnce<T>(path, options);
    } catch (retryError) {
      if (retryError instanceof RequestError && retryError.statusCode === 401) {
        if (usesBrowserCookieTransport()) customerAuth.clear();
        else customerAuth.blockAutomaticRecovery();
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
