import { strict as assert } from 'node:assert';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { MetricsService } from '../../modules/metrics/metrics.service';
import {
  AccessLogEntry,
  createHttpObservabilityMiddleware,
  resolveRouteTemplate,
} from './http-observability.middleware';

class TestResponse extends EventEmitter {
  statusCode = 201;
  private readonly headers = new Map<string, string | number | string[]>();

  setHeader(name: string, value: string): void {
    this.headers.set(name.toLowerCase(), value);
  }

  getHeader(name: string): string | number | string[] | undefined {
    return this.headers.get(name.toLowerCase());
  }
}

test('records a route-template metric and structured access log without request data', async () => {
  const metrics = new MetricsService();
  const logs: AccessLogEntry[] = [];
  const middleware = createHttpObservabilityMiddleware(metrics, (entry) => logs.push(entry));
  const response = new TestResponse();
  response.setHeader('Content-Length', '42');
  const request = {
    method: 'post',
    originalUrl: '/api/orders/customer-123?token=secret',
    route: { path: '/api/orders/:id' },
    headers: { 'x-request-id': 'request-123' },
  };

  let nextCalled = false;
  middleware(request, response, () => { nextCalled = true; });
  response.emit('finish');
  response.emit('close');

  assert.equal(nextCalled, true);
  assert.equal(response.getHeader('x-request-id'), 'request-123');
  assert.equal(logs.length, 1);
  assert.deepEqual(logs[0], {
    timestamp: logs[0].timestamp,
    level: 'INFO',
    service: 'lingdian-api',
    event: 'HTTP_REQUEST',
    requestId: 'request-123',
    method: 'POST',
    route: '/api/orders/:id',
    statusCode: 201,
    durationMs: logs[0].durationMs,
    responseBytes: 42,
  });
  assert.doesNotMatch(JSON.stringify(logs[0]), /customer-123|secret/);

  const rendered = await metrics.render();
  assert.match(rendered, /lingdian_http_requests_total\{[^\n]*method="POST"[^\n]*route="\/api\/orders\/:id"[^\n]*status_code="201"[^\n]*\} 1/);
  assert.match(rendered, /process_cpu_user_seconds_total/);
});

test('does not use unmatched URLs as metric labels', () => {
  assert.equal(resolveRouteTemplate({ originalUrl: '/api/users/private-user-id?x=1' }), 'unmatched');
  assert.equal(resolveRouteTemplate({ originalUrl: '/api/health/ready?probe=1' }), '/api/health/ready');
});

test('excludes the metrics scrape from request metrics and access logs', async () => {
  const metrics = new MetricsService();
  const logs: AccessLogEntry[] = [];
  const middleware = createHttpObservabilityMiddleware(metrics, (entry) => logs.push(entry));
  const response = new TestResponse();

  middleware({ method: 'GET', route: { path: '/api/metrics' } }, response, () => undefined);
  response.emit('finish');

  assert.equal(logs.length, 0);
  assert.doesNotMatch(await metrics.render(), /lingdian_http_requests_total\{/);
});
