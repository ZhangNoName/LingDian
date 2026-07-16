import type { ApiEnvelope } from "@lingdian/contracts";
import { customerAuth } from "./auth";
import { API_BASE, ASSET_BASE } from "../config/api";

type RequestMethod = NonNullable<UniApp.RequestOptions["method"]> | "PATCH";

type RequestConfig = Omit<UniApp.RequestOptions, "url" | "header" | "method"> & {
  header?: Record<string, string>;
  method?: RequestMethod;
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
    const { method, ...requestOptions } = options;
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
        reject(new RequestError(envelope?.msg || "Request failed.", response.statusCode));
      },
      fail(error) {
        reject(new RequestError(error.errMsg || "Network request failed."));
      },
    });
  });
}

export async function request<T>(path: string, options: RequestConfig = {}): Promise<T> {
  try {
    return await requestOnce<T>(path, options);
  } catch (error) {
    if (!(error instanceof RequestError) || error.statusCode !== 401) throw error;

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
