import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { Prisma } from '@lingdian/db';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { MerchantDashboardService } from './merchant-dashboard.service';
import { MerchantStoreScope } from './merchant-store-scope';
import { DashboardQueryDto, dashboardPeriod } from './dto/dashboard-query.dto';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
const user: AuthenticatedUser = { userId: 'm', sessionId: 's', audience: 'merchant-api', roles: ['MERCHANT'], merchantStoreIds: ['store-a'] };
const period = { startAt: '2026-11-01T16:00:00.000Z', endAt: '2026-11-02T16:00:00.000Z' };
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE orders(id TEXT,storeId TEXT,status TEXT,orderType TEXT,isDeleted INTEGER,createdAt TEXT,cents INTEGER); CREATE TABLE order_items(orderId TEXT,productId TEXT,skuId TEXT,productName TEXT,skuName TEXT,quantity INTEGER)');
  const insert = db.prepare('INSERT INTO orders VALUES(?,?,?,?,?,?,?)');
  for (const row of [
    ['paid','store-a','PAID','PICKUP',0,period.startAt,1234], ['completed','store-a','COMPLETED','DINE_IN',0,'2026-11-02T00:00:00.000Z',2000],
    ['pending','store-a','PENDING_PAYMENT','PICKUP',0,period.startAt,1000], ['refund','store-a','REFUNDING','PICKUP',0,period.startAt,8000], ['cancelled','store-a','CANCELLED','PICKUP',0,period.startAt,9000],
    ['before','store-a','PAID','PICKUP',0,'2026-11-01T15:59:59.999Z',9999], ['end','store-a','PAID','PICKUP',0,period.endAt,9999], ['deleted','store-a','PAID','PICKUP',1,period.startAt,9999], ['foreign','store-b','PAID','PICKUP',0,period.startAt,9999],
  ]) insert.run(...row as (string | number)[]);
  const item = db.prepare('INSERT INTO order_items VALUES(?,?,?,?,?,?)');
  for (const row of [['paid','p1','sku1','Bread','Regular',2],['paid','p1','sku1','Bread','Regular',3],['completed','p1','sku1','Renamed bread','Regular',4],['completed','p1',null,'Legacy bread',null,1],['refund','p1','sku1','Bread','Regular',999],['foreign','p1','sku1','Bread','Regular',999]]) item.run(...row as (string | number | null)[]);
  let calls = 0;
  const tx: any = {
    order: {
      groupBy: async ({ where }: any) => { calls++; return db.prepare('SELECT status,orderType,COUNT(*) AS n,SUM(cents) AS cents FROM orders WHERE storeId=? AND isDeleted=0 AND createdAt>=? AND createdAt<? GROUP BY status,orderType').all(where.storeId, where.createdAt.gte.toISOString(), where.createdAt.lt.toISOString()).map((row: any) => ({ status: row.status, orderType: row.orderType, _count: { _all: row.n }, _sum: { payableAmount: new Prisma.Decimal(row.cents).div(100) } })); },
      count: async ({ where }: any) => { assert.equal(where.storeId, 'store-a'); assert.equal(where.createdAt, undefined); return where.stockExpiresAt ? 2 : 3; },
    },
    inventoryAlert: { count: async ({ where }: any) => { assert.equal(where.storeId, 'store-a'); return where.status === 'OPEN' ? 1 : 2; } },
    inventoryItem: { count: async ({ where }: any) => { assert.equal(where.storeId, 'store-a'); assert.equal(where.isActive, true); return where.availableQuantity === 0 ? 4 : 5; } },
    $queryRaw: async (query: Prisma.Sql) => db.prepare(query.sql).all(...query.values.map(value => value instanceof Date ? value.toISOString() : value as string)),
  };
  const service = new MerchantDashboardService({ inventoryItem: { fields: { reorderPoint: 'reorderPoint' } }, $transaction: async (work: any, options: any) => { assert.equal(options.isolationLevel, 'RepeatableRead'); return work(tx); } } as never, new MerchantStoreScope({ resolveStoreIds: (ids: string[]) => ids } as never));
  return { db, service, calls: () => calls };
}
test('dashboard uses a scoped half-open creation cohort, exact amounts and eligible current statuses', async () => {
  const f = fixture(); try {
    const result = await f.service.snapshot(user, 'store-a', period);
    assert.deepEqual(result.orders, { total: 5, paid: 2, completed: 1, pendingPayment: 1, refunding: 1, refunded: 0, cancelled: 1, timedOut: 0, failed: 0, paidAmount: 32.34 });
    assert.equal(result.orderTypes.find(row => row.type === 'PICKUP')!.paidAmount, 12.34); assert.equal(result.currency, 'CNY');
    assert.equal(result.operations.expiredStockHoldOrders, 2); assert.equal(result.operations.outOfStockMaterials, 4);
  } finally { f.db.close(); }
});
test('ranking SQL counts distinct orders and retains historical and nullable SKU snapshots', async () => {
  const f = fixture(); try {
    const result = await f.service.snapshot(user, 'store-a', period);
    assert.deepEqual(result.topItems.map(row => [row.productName,row.skuId,row.quantity,row.orderCount]), [['Bread','sku1',5,1],['Renamed bread','sku1',4,1],['Legacy bread',null,1,1]]);
  } finally { f.db.close(); }
});
test('dashboard rejects unauthorized and unselected multi-store scope before aggregating', async () => {
  const f = fixture(); try {
    await assert.rejects(f.service.snapshot(user, 'store-b', period), /not authorized/);
    await assert.rejects(f.service.snapshot({ ...user, merchantStoreIds: ['store-a','store-b'] }, undefined, period), /Select a store/);
    assert.equal(f.calls(), 0);
  } finally { f.db.close(); }
});
test('dashboard periods require explicit instants, valid order and bounded range', () => {
  for (const query of [{ startAt: '2026-11-01', endAt: period.endAt }, { startAt: period.startAt, endAt: 'bad' }]) assert.ok(validateSync(plainToInstance(DashboardQueryDto, query)).length);
  for (const query of [{ startAt: period.endAt, endAt: period.startAt }, { startAt: '2020-01-01T00:00:00Z', endAt: period.endAt }]) assert.throws(() => dashboardPeriod(query), /dashboard.invalidPeriod/);
});
