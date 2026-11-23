import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { Prisma } from '@lingdian/db';
import { InventoryReportService } from './inventory-report.service';
import { MerchantStoreScope } from '../merchant/merchant-store-scope';
import { activityPeriod, movementWhere, MAX_REPORT_ITEMS } from './inventory-query';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';

const user: AuthenticatedUser = { userId: 'merchant-a', sessionId: 's', audience: 'merchant-api', roles: ['MERCHANT'], merchantStoreIds: ['store-a'] };
const scope = new MerchantStoreScope({ resolveStoreIds: (ids: string[]) => ids } as never);
const period = { startAt: '2026-11-01T00:00:00.000Z', endAt: '2026-11-07T00:00:00.000Z' };

// Execute the actual parameterized aggregation against a relational SQL engine.
// This verifies report semantics, but is not a substitute for MySQL migration/adapter tests.
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.function('GREATEST', (a, b) => Math.max(Number(a), Number(b)));
  db.exec('CREATE TABLE inventory_movements (itemId TEXT, storeId TEXT, kind TEXT, amount INTEGER, quantityBefore INTEGER, quantityAfter INTEGER, createdAt TEXT)');
  const insert = db.prepare('INSERT INTO inventory_movements VALUES (?, ?, ?, ?, ?, ?, ?)');
  const movement = (itemId: string, storeId: string, kind: string, amount: number, before: number, after: number, at: string) => insert.run(itemId, storeId, kind, amount, before, after, at);
  movement('flour', 'store-a', 'RECEIVE', 10000, 0, 10000, '2026-10-31T23:59:59.999Z');
  movement('flour', 'store-a', 'RECEIVE', 2000, 10000, 12000, period.startAt);
  movement('flour', 'store-a', 'ISSUE', 1125, 12000, 10875, '2026-11-02T00:00:00.000Z');
  movement('flour', 'store-a', 'LOSS', 375, 10875, 10500, '2026-11-03T00:00:00.000Z');
  movement('flour', 'store-a', 'COUNT', 11000, 10500, 11000, '2026-11-04T00:00:00.000Z');
  movement('flour', 'store-a', 'COUNT', 9750, 11000, 9750, '2026-11-05T00:00:00.000Z');
  movement('flour', 'store-a', 'THRESHOLD', 5000, 9750, 9750, '2026-11-06T00:00:00.000Z');
  movement('flour', 'store-a', 'RECEIVE', 5000, 9750, 14750, period.endAt);
  movement('milk', 'store-a', 'RECEIVE', 3000, 0, 3000, '2026-10-31T00:00:00.000Z');
  movement('milk', 'store-a', 'ISSUE', 1000, 3000, 2000, '2026-11-03T00:00:00.000Z');
  movement('flour', 'store-b', 'RECEIVE', 900000, 0, 900000, '2026-11-02T00:00:00.000Z');
  movement("x') OR 1=1 --", 'store-a', 'RECEIVE', 1000, 0, 1000, '2026-11-02T00:00:00.000Z');
  const items = [{ id: 'flour', code: 'A', name: 'Flour', unit: 'kg' }, { id: 'milk', code: 'B', name: 'Milk', unit: 'L' }, { id: 'empty', code: 'C', name: 'Salt', unit: 'bag' }, { id: "x') OR 1=1 --", code: 'D', name: 'Quoted id', unit: 'bag' }];
  let queries = 0;
  const tx = {
    inventoryItem: { findMany: async ({ where }: any) => { assert.equal(where.storeId, 'store-a'); assert.equal(where.createdAt.lt.toISOString(), period.endAt); return items.filter((item) => !where.id || item.id === where.id); } },
    $queryRaw: async (query: Prisma.Sql) => {
      queries++;
      return db.prepare(query.sql).all(...query.values.map((value) => value instanceof Date ? value.toISOString() : value as string));
    },
  };
  const prisma = { $transaction: async (fn: (tx: unknown) => unknown, options: any) => { assert.equal(options.isolationLevel, 'RepeatableRead'); return fn(tx); } };
  return { db, service: new InventoryReportService(prisma as never, scope), queries: () => queries };
}

test('period report reconstructs balances and separates receipts, issues, loss and count differences', async () => {
  const f = fixture();
  try {
    const result = await f.service.report(user, 'store-a', period);
    assert.deepEqual(result.rows[0], { itemId: 'flour', code: 'A', name: 'Flour', unit: 'kg', opening: 10, received: 2, issued: 1.125, lost: 0.375, countGain: 0.5, countLoss: 1.25, closing: 9.75, movementCount: 6 });
    assert.equal(result.rows[1].unit, 'L'); assert.equal(result.rows[1].closing, 2);
    assert.equal(result.rows[2].closing, 0); assert.equal(result.rows[2].movementCount, 0);
    for (const row of result.rows) assert.equal(Math.round((row.opening + row.received - row.issued - row.lost + row.countGain - row.countLoss) * 1000), Math.round(row.closing * 1000));
    assert.equal(result.startAt, period.startAt); assert.equal(result.endAt, period.endAt);
    assert.equal(result.storeId, 'store-a');
  } finally { f.db.close(); }
});

test('report validates tenant scope before data access and parameterizes material selection', async () => {
  const f = fixture();
  try {
    await assert.rejects(f.service.report(user, 'store-b', period), /not authorized/);
    assert.equal(f.queries(), 0);
    const result = await f.service.report(user, 'store-a', { ...period, itemId: "x') OR 1=1 --" });
    assert.equal(result.rows.length, 1); assert.equal(result.rows[0].closing, 1); assert.equal(f.queries(), 1);
    const selected = await f.service.report(user, 'store-a', { ...period, itemId: 'milk' });
    assert.deepEqual(selected.rows.map((row) => row.itemId), ['milk']);
    assert.equal(selected.rows[0].closing, 2);
  } finally { f.db.close(); }
});

test('oversize reports are rejected rather than silently truncated', async () => {
  let aggregateRead = false;
  const service = new InventoryReportService({ $transaction: async (fn: (tx: unknown) => unknown) => fn({
    inventoryItem: { findMany: async () => Array.from({ length: MAX_REPORT_ITEMS + 1 }, () => ({ id: 'x' })) },
    $queryRaw: async () => { aggregateRead = true; },
  }) } as never, scope);
  await assert.rejects(service.report(user, 'store-a', period), /inventory.reportTooLarge/);
  assert.equal(aggregateRead, false);
});

test('periods reject reversed, missing and excessive ranges; history predicates share exclusive end', () => {
  for (const query of [{}, { startAt: period.endAt, endAt: period.startAt }, { startAt: 'bad', endAt: period.endAt }, { startAt: '2025-01-01T00:00:00Z', endAt: period.endAt }]) assert.throws(() => activityPeriod(query, true), /inventory.invalidPeriod/);
  assert.deepEqual(movementWhere('store-a', { page: 1, pageSize: 20, kind: 'LOSS', itemId: 'flour', keyword: 'Flour' }, activityPeriod(period)), {
    storeId: 'store-a', itemId: 'flour', kind: 'LOSS', createdAt: { gte: new Date(period.startAt), lt: new Date(period.endAt) }, item: { OR: [{ name: { contains: 'Flour' } }, { code: { contains: 'Flour' } }] },
  });
});
