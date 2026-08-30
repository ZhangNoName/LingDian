import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Test } from '@nestjs/testing';
import { MetricsModule } from './metrics.module';

test('serves Prometheus text directly without the API response envelope', async () => {
  const testingModule = await Test.createTestingModule({ imports: [MetricsModule] }).compile();
  const app = testingModule.createNestApplication();
  app.setGlobalPrefix('api');

  try {
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as { port: number };
    const response = await fetch(`http://127.0.0.1:${address.port}/api/metrics`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /text\/plain/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(body, /# HELP process_cpu_user_seconds_total/);
    assert.match(body, /# HELP lingdian_http_requests_total/);
    assert.doesNotMatch(body, /"code"\s*:/);

    for (const path of ['/API/metrics', '/api/METRICS', '/Api/MeTrIcS']) {
      const mixedCaseResponse = await fetch(`http://127.0.0.1:${address.port}${path}`);
      assert.equal(mixedCaseResponse.status, 404, `${path} must not expose metrics`);
    }
  } finally {
    await app.close();
  }
});
