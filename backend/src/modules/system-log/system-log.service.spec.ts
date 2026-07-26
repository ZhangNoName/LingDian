import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { SystemLogService, sanitizeLogDetails, sanitizeLogMessage } from './system-log.service';

test('sanitizeLogDetails redacts secrets and limits serialized payload size', () => {
  const details = sanitizeLogDetails({
    authorization: 'Bearer secret-token',
    password: 'not-for-storage',
    safe: 'visible',
    nested: { refreshToken: 'also-secret', value: 'x'.repeat(5000) },
  });

  assert.deepEqual(details, {
    authorization: '[REDACTED]',
    password: '[REDACTED]',
    safe: 'visible',
    nested: { refreshToken: '[REDACTED]', value: 'x'.repeat(1024) },
  });
  assert.ok(JSON.stringify(details).length <= 4096);
});

test('sanitizeLogMessage removes token-like values before persistence', () => {
  assert.equal(
    sanitizeLogMessage('Request failed with Authorization: Bearer private-token?access_token=also-private'),
    'Request failed with Authorization: Bearer [REDACTED]?access_token=[REDACTED]',
  );
});

test('SystemLogService records only client-safe sources and bounds stored fields', async () => {
  const created: Array<{ data: Record<string, unknown> }> = [];
  const deleted: Array<{ where: unknown }> = [];
  const service = new SystemLogService({
    systemLog: {
      create: async (input: { data: Record<string, unknown> }) => created.push(input),
      deleteMany: async (input: { where: unknown }) => deleted.push(input),
    },
  } as never);

  await service.recordClientEvent({
    source: 'ADMIN_WEB',
    level: 'ERROR',
    event: 'client_error'.repeat(10),
    message: 'x'.repeat(600),
    details: { token: 'secret', browser: 'Chrome' },
    path: '/system-logs/client-events?access_token=secret',
  });

  assert.equal(created.length, 1);
  assert.equal(created[0].data.source, 'ADMIN_WEB');
  assert.equal(created[0].data.level, 'ERROR');
  assert.equal((created[0].data.event as string).length, 64);
  assert.equal((created[0].data.message as string).length, 512);
  assert.deepEqual(created[0].data.details, { token: '[REDACTED]', browser: 'Chrome' });
  assert.equal(created[0].data.path, '/system-logs/client-events');
  assert.equal(deleted.length, 1);

  await assert.rejects(
    () => service.recordClientEvent({ source: 'SERVER', level: 'ERROR', event: 'invalid', message: 'invalid' }),
    /Client logs must identify a frontend source/,
  );
});

test('SystemLogService returns a filtered offset page with a total count', async () => {
  const calls: Array<{ where?: unknown; skip?: number; take?: number }> = [];
  const service = new SystemLogService({
    systemLog: {
      count: async (input: { where?: unknown }) => {
        calls.push(input);
        return 43;
      },
      findMany: async (input: { where?: unknown; skip?: number; take?: number }) => {
        calls.push(input);
        return [
          { id: 'page-item', source: 'SERVER', level: 'ERROR', category: 'HTTP', event: 'REQUEST_FAILED', message: 'boom', requestId: null, userId: null, method: 'GET', path: '/orders', statusCode: 500, ip: '127.0.0.***', details: { password: 'not-retroactively-safe' }, createdAt: new Date('2026-07-16T00:00:00.000Z') },
        ];
      },
    },
  } as never);

  const page = await service.query({ page: 3, pageSize: 20, source: 'SERVER', level: 'ERROR' });

  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].id, 'page-item');
  assert.equal(page.items[0].details?.password, '[REDACTED]');
  assert.equal(page.total, 43);
  assert.equal(page.page, 3);
  assert.equal(page.pageSize, 20);
  assert.deepEqual(calls[0].where, { source: 'SERVER', level: 'ERROR' });
  assert.equal(calls[1].skip, 40);
  assert.equal(calls[1].take, 20);
  assert.deepEqual(calls[1].where, { source: 'SERVER', level: 'ERROR' });
});

test('SystemLogService accepts at most twenty client events per source and IP each minute', async () => {
  const created: unknown[] = [];
  const service = new SystemLogService({
    systemLog: { create: async (input: unknown) => created.push(input), deleteMany: async () => undefined },
  } as never);

  for (let index = 0; index < 21; index += 1) {
    await service.recordClientEvent({ source: 'MINIAPP', level: 'ERROR', event: 'CLIENT_ERROR', message: 'failed', ip: '127.0.0.1' });
  }

  assert.equal(created.length, 20);
});
