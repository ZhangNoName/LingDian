import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '@lingdian/contracts';
import { MobileInboxService } from './mobile-inbox.service';

const customer: AuthenticatedUser = { userId: 'customer-1', sessionId: 'customer-session', audience: 'user-api', roles: ['USER'] };
const merchant: AuthenticatedUser = {
  userId: 'merchant-1', sessionId: 'merchant-session', audience: 'merchant-api', roles: ['MERCHANT'], merchantStoreIds: ['store-1'],
};

test('validates cursor and signed store scope before executing notification queries', async () => {
  let reads = 0;
  const service = new MobileInboxService(
    { $queryRaw: async () => { reads++; return []; } } as never,
    { forRequest: () => { throw new ForbiddenException('Store access denied'); } } as never,
    { mode: 'single', primaryStoreId: () => 'store-1' } as never,
  );

  await assert.rejects(service.page(customer, undefined, 'bad|cursor'), BadRequestException);
  await assert.rejects(service.page(merchant, 'another-store'), ForbiddenException);
  await assert.rejects(service.page({ ...customer, audience: 'admin-api' }), ForbiddenException);
  assert.equal(reads, 0);
});

test('forms a deterministic cursor from the last returned event and passes it as bound data', async () => {
  const date = new Date('2026-11-25T08:05:30.135Z');
  let calls = 0;
  const service = new MobileInboxService(
    {
      $queryRaw: async (_template: TemplateStringsArray, ...parts: Array<{ values?: unknown[]; sql: string } | number>) => {
        calls++;
        const source = parts[0];
        assert.ok(typeof source === 'object' && source.values?.includes(customer.userId));
        if (calls === 2) {
          assert.ok(source.values?.includes('order-status:event2'));
          assert.match(source.sql, /ORDER BY m.createdAt DESC, m.id DESC LIMIT/);
          return [];
        }
        return Array.from({ length: 26 }, (_, index) => ({
          id: `order-status:event${26 - index}`,
          kind: 'ORDER_UPDATE',
          targetId: 'order-1',
          subject: 'LD001',
          state: 'READY',
          createdAt: date,
          readAt: index === 0 ? date : null,
        }));
      },
    } as never,
    {} as never,
    { mode: 'single', primaryStoreId: () => 'store-1' } as never,
  );

  const page = await service.page(customer);
  assert.equal(page.items.length, 25);
  assert.equal(page.items[0].read, true);
  assert.equal(page.items[0].createdAt, date.toISOString());
  assert.ok(page.nextCursor);
  assert.deepEqual(await service.page(customer, undefined, page.nextCursor), { items: [], nextCursor: null });
});

test('validates and binds the bulk read boundary inside the current scope', async () => {
  let executions = 0;
  const service = new MobileInboxService(
    {
      $executeRaw: async (_template: TemplateStringsArray, ...parts: Array<unknown>) => {
        executions++;
        assert.equal(parts[0], customer.userId);
        assert.equal(parts[1], 'customer');
        const boundary = parts[3] as { values: unknown[]; sql: string };
        assert.match(boundary.sql, /m.id <=/);
        assert.deepEqual(boundary.values, [
          new Date('2026-11-25T08:00:00.001Z'), new Date('2026-11-25T08:00:00.001Z'), 'order-status:visible',
        ]);
      },
    } as never,
    {} as never,
    { mode: 'single', primaryStoreId: () => 'store-1' } as never,
  );
  await assert.rejects(
    service.markRead(customer, undefined, undefined, { id: 'order-status:visible', createdAt: '' }),
    BadRequestException,
  );
  await service.markRead(customer, undefined, undefined, { id: 'order-status:visible', createdAt: '2026-11-25T08:00:00.001Z' });
  assert.equal(executions, 1);
});

test('unread polling identifies a feed change even when all its messages are read', async () => {
  const timestamp = '2026-11-25T08:05:30.135Z';
  let queries = 0;
  const service = new MobileInboxService(
    {
      $queryRaw: async (_template: TemplateStringsArray, source: { values: unknown[]; sql: string }) => {
        queries++;
        assert.match(source.sql, /COUNT\(CASE WHEN r.eventId IS NULL THEN 1 END\)/);
        assert.match(source.sql, /COUNT\(\*\) AS totalEvents/);
        assert.ok(source.values.includes(customer.userId));
        return [{ count: 0n, totalEvents: 65n, newestUnread: null, newestEvent: `${timestamp}|order-status:read` }];
      },
    } as never,
    {} as never,
    { mode: 'single', primaryStoreId: () => 'store-1' } as never,
  );
  assert.deepEqual(await service.unread(customer), {
    count: 0, newestUnread: null, totalEvents: 65, newestEvent: { id: 'order-status:read', createdAt: timestamp },
  });
  assert.equal(queries, 1);
});
