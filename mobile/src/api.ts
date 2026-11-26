import { Platform } from 'react-native';
import { ApiError } from './api-error';

export { ApiError } from './api-error';

const developmentHost = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
const configured = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
export const apiBase = configured || (__DEV__ ? `http://${developmentHost}:9000/api` : 'https://api.zsf.shopping/api');

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: object;
  signal?: AbortSignal;
};

type HeadersInput = { token?: string; device?: string; store?: string };

export function endpoint(path: string, parameters: Record<string, string | number | boolean | undefined> = {}) {
  const query = Object.entries(parameters)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return query ? `${path}?${query}` : path;
}

export function assetUrl(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  if (raw.startsWith('/uploads/')) return new URL(raw, apiBase).href;
  if (/^https:\/\//i.test(raw) || /^data:image\/(?:jpeg|png|webp);base64,/i.test(raw)) return raw;
  return undefined;
}

const fallback: Record<number, string> = {
  400: '请检查输入内容。',
  401: '登录凭证无效或已过期。',
  403: '当前身份没有权限执行此操作。',
  404: '未找到这条记录。',
  409: '记录已发生变化，请刷新后重试。',
  429: '操作过于频繁，请稍后重试。',
};

export function humanError(error: unknown): string {
  return error instanceof Error ? error.message : '操作未完成，请重试。';
}

function responseMessage(status: number, message: unknown, data: unknown): string {
  const fieldMessage = Array.isArray(data) ? data.find((field) => typeof field === 'string' && /[\u3400-\u9fff]/.test(field)) : undefined;
  if (typeof fieldMessage === 'string') return fieldMessage;
  if (status === 401 && typeof message === 'string' && message.includes('credentials')) return '账号、密码或身份无效。';
  if (typeof message === 'string' && /[\u3400-\u9fff]/.test(message) && status < 500) return message;
  return fallback[status] ?? '服务暂时不可用，请稍后重试。';
}

export async function request<T>(path: string, options: RequestOptions = {}, auth: HeadersInput = {}): Promise<T> {
  if (!__DEV__ && !apiBase.startsWith('https://')) throw new ApiError(0, '发布版接口地址须使用 HTTPS。');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
  if (auth.device) headers['X-Device-Id'] = auth.device;
  if (auth.store) headers['X-Store-Id'] = auth.store;
  const multipart = options.body instanceof FormData;
  if (options.body && !multipart) headers['Content-Type'] = 'application/json';
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, 15_000);
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();

  try {
    let response: Response;
    try {
      response = await fetch(`${apiBase}${path}`, {
        method: options.method ?? 'GET',
        body: options.body ? (multipart ? options.body as FormData : JSON.stringify(options.body)) : undefined,
        headers,
        signal: controller.signal,
        credentials: 'omit',
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new ApiError(0, controller.signal.aborted ? '请求超时，请重试。' : '无法连接服务器，请检查网络。');
    }
    if (response.status === 204) return undefined as T;
    const payload = await response.json().catch(() => null) as { code?: number; msg?: string; data?: unknown } | null;
    if (!response.ok || payload?.code !== 0) {
      const code = typeof payload?.code === 'number' && payload.code !== 0 ? payload.code : undefined;
      throw new ApiError(response.status, responseMessage(response.status, payload?.msg, payload?.data), payload?.data, code);
    }
    return payload.data as T;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}
