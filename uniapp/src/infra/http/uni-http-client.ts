import type { ApiEnvelope } from "@lingdian/contracts";
import { API_TIMEOUT_MS, buildApiUrl } from "@/config/api";
import { usesBrowserCookieTransport } from "@/config/platform";

export type HttpMethod = NonNullable<UniApp.RequestOptions["method"]> | "PATCH";

export type HttpRequest = Omit<UniApp.RequestOptions, "url" | "header" | "method" | "success" | "fail"> & {
  path: string;
  header?: Record<string, string>;
  method?: HttpMethod;
};

export type HttpResponse<T = unknown> = {
  statusCode: number;
  data: T;
  header: Record<string, string>;
};

/** Transport error: the request never produced a usable HTTP response. */
export class NetworkError extends Error {
  constructor(message: string, readonly causeMessage?: string) {
    super(message);
    this.name = "NetworkError";
  }
}

/** Protocol/API error: HTTP completed but the envelope or status was rejected. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface HttpTransport {
  send<T>(request: HttpRequest): Promise<HttpResponse<T>>;
}

/**
 * The sole adapter around uni.request. Business services depend on HttpTransport,
 * so replacing uni-app, adding a mock, or routing through a native gateway does
 * not change authentication and domain services.
 */
export class UniHttpTransport implements HttpTransport {
  send<T>(request: HttpRequest): Promise<HttpResponse<T>> {
    return new Promise((resolve, reject) => {
      const { path, method, header, ...options } = request;
      uni.request({
        ...options,
        url: buildApiUrl(path),
        method: method as UniApp.RequestOptions["method"],
        timeout: options.timeout ?? API_TIMEOUT_MS,
        // uni.request only maintains cookies automatically on H5. Native
        // mini-program sessions recover through a fresh provider login code.
        withCredentials: usesBrowserCookieTransport(),
        header: {
          "Content-Type": "application/json",
          ...(header ?? {}),
        },
        success(response) {
          resolve({
            statusCode: response.statusCode,
            data: response.data as T,
            header: (response.header ?? {}) as Record<string, string>,
          });
        },
        fail(error) {
          reject(new NetworkError("网络连接异常，请检查网络后重试。", error.errMsg));
        },
      });
    });
  }
}

export const uniHttpTransport: HttpTransport = new UniHttpTransport();

export async function requestApiEnvelope<T>(
  request: HttpRequest,
  transport: HttpTransport = uniHttpTransport,
): Promise<T> {
  const response = await transport.send<ApiEnvelope<T>>(request);
  if (response.statusCode === 204) return undefined as T;

  const envelope = response.data;
  if (
    response.statusCode >= 200 &&
    response.statusCode < 300 &&
    envelope &&
    envelope.code === 0
  ) {
    return envelope.data;
  }

  throw new ApiError(
    envelope?.msg || "Request failed.",
    response.statusCode,
    envelope?.code,
  );
}
