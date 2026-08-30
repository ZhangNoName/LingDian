import { randomUUID } from 'node:crypto';
import { MetricsService } from '../../modules/metrics/metrics.service';

type RoutePath = string | string[] | RegExp;

export type ObservableHttpRequest = {
  method?: string;
  originalUrl?: string;
  url?: string;
  baseUrl?: string;
  route?: { path?: RoutePath };
  headers?: Record<string, string | string[] | undefined>;
};

export type ObservableHttpResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  getHeader(name: string): string | number | string[] | undefined;
  once(event: 'finish' | 'close', listener: () => void): unknown;
};

export type AccessLogEntry = {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  service: 'lingdian-api';
  event: 'HTTP_REQUEST';
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  responseBytes?: number;
};

type AccessLogWriter = (entry: AccessLogEntry) => void;

export function createHttpObservabilityMiddleware(
  metrics: MetricsService,
  writeLog: AccessLogWriter = writeJsonAccessLog,
) {
  return (
    request: ObservableHttpRequest,
    response: ObservableHttpResponse,
    next: () => void,
  ): void => {
    const startedAt = process.hrtime.bigint();
    const requestId = resolveRequestId(request.headers?.['x-request-id']);
    response.setHeader('X-Request-Id', requestId);
    let completed = false;

    const complete = () => {
      if (completed) return;
      completed = true;
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
      const method = normalizeMethod(request.method);
      const route = resolveRouteTemplate(request);
      const statusCode = response.statusCode || 0;

      if (route !== '/api/metrics') {
        metrics.observeHttpRequest(
          { method, route, statusCode: String(statusCode) },
          durationSeconds,
        );
        writeLog({
          timestamp: new Date().toISOString(),
          level: accessLogLevel(statusCode),
          service: 'lingdian-api',
          event: 'HTTP_REQUEST',
          requestId,
          method,
          route,
          statusCode,
          durationMs: Math.round(durationSeconds * 100_000) / 100,
          ...responseLength(response),
        });
      }
    };

    response.once('finish', complete);
    response.once('close', complete);
    next();
  };
}

export function resolveRouteTemplate(request: ObservableHttpRequest): string {
  const routePath = request.route?.path;
  if (typeof routePath === 'string') {
    return normalizeRoute(`${request.baseUrl ?? ''}${routePath}`);
  }
  if (Array.isArray(routePath) && routePath.length === 1) {
    return normalizeRoute(`${request.baseUrl ?? ''}${routePath[0]}`);
  }

  const pathname = (request.originalUrl ?? request.url ?? '').split('?', 1)[0];
  if (isKnownLowCardinalityPath(pathname)) return normalizeRoute(pathname);
  return 'unmatched';
}

function isKnownLowCardinalityPath(pathname: string): boolean {
  return [
    '/api/health',
    '/api/health/live',
    '/api/health/ready',
    '/api/metrics',
  ].includes(pathname);
}

function normalizeRoute(route: string): string {
  const withLeadingSlash = route.startsWith('/') ? route : `/${route}`;
  const normalized = withLeadingSlash.replace(/\/+/g, '/');
  return normalized.length > 1 && normalized.endsWith('/')
    ? normalized.slice(0, -1)
    : normalized;
}

function resolveRequestId(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && /^[A-Za-z0-9._:-]{1,64}$/.test(candidate)
    ? candidate
    : randomUUID();
}

function normalizeMethod(method: string | undefined): string {
  const candidate = method?.toUpperCase() ?? 'UNKNOWN';
  return /^[A-Z]{1,16}$/.test(candidate) ? candidate : 'OTHER';
}

function accessLogLevel(statusCode: number): AccessLogEntry['level'] {
  if (statusCode >= 500 || statusCode === 0) return 'ERROR';
  if (statusCode >= 400) return 'WARN';
  return 'INFO';
}

function responseLength(response: ObservableHttpResponse): { responseBytes?: number } {
  const value = response.getHeader('content-length');
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? { responseBytes: parsed } : {};
}

function writeJsonAccessLog(entry: AccessLogEntry): void {
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}
