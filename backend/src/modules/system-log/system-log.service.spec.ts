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

test('SystemLogService uses the last visible record as cursor so the next page does not skip a log', async () => {
  const calls: Array<{ cursor?: { id: string }; skip?: number }> = [];
  const service = new SystemLogService({
    systemLog: {
      findMany: async (input: { cursor?: { id: string }; skip?: number }) => {
        calls.push(input);
        return input.cursor
          ? [
              { id: 'cursor', source: 'ADMIN_WEB', level: 'WARN', category: 'CLIENT', event: 'CLIENT_ERROR', message: 'bad state', requestId: null, userId: null, method: null, path: null, statusCode: null, ip: null, details: null, createdAt: new Date('2026-07-15T00:00:00.000Z') },
              { id: 'older', source: 'SERVER', level: 'ERROR', category: 'HTTP', event: 'REQUEST_FAILED', message: 'older', requestId: null, userId: null, method: 'GET', path: '/orders', statusCode: 500, ip: '127.0.0.***', details: null, createdAt: new Date('2026-07-14T00:00:00.000Z') },
            ]
          : [
              { id: 'newer', source: 'SERVER', level: 'ERROR', category: 'HTTP', event: 'REQUEST_FAILED', message: 'boom', requestId: null, userId: null, method: 'GET', path: '/orders', statusCode: 500, ip: '127.0.0.***', details: { password: 'not-retroactively-safe' }, createdAt: new Date('2026-07-16T00:00:00.000Z') },
              { id: 'cursor', source: 'ADMIN_WEB', level: 'WARN', category: 'CLIENT', event: 'CLIENT_ERROR', message: 'bad state', requestId: null, userId: null, method: null, path: null, statusCode: null, ip: null, details: null, createdAt: new Date('2026-07-15T00:00:00.000Z') },
            ];
      },
    },
  } as never);

  const page = await service.query({ limit: 1, source: 'SERVER' });

  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].id, 'newer');
  assert.equal(page.items[0].details?.password, '[REDACTED]');
  assert.equal(page.nextCursor, 'newer');

  const nextPage = await service.query({ limit: 1, cursor: page.nextCursor! });
  assert.equal(calls[1].cursor?.id, 'newer');
  assert.equal(calls[1].skip, 1);
  assert.equal(nextPage.items[0].id, 'cursor');
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
