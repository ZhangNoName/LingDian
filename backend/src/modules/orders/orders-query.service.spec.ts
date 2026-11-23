import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { Prisma } from '@lingdian/db';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { OrdersQueryService } from './orders-query.service';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
function fixture() {
  const db = new DatabaseSync(':memory:'); db.exec('CREATE TABLE orders(storeId TEXT,status TEXT,createdAt TEXT,cents INTEGER,isDeleted INTEGER)');
  const insert = db.prepare('INSERT INTO orders VALUES(?,?,?,?,?)');
  for (const row of [['store-a','PAID','2026-11-01T00:00:00.000Z',1234,0],['store-a','COMPLETED','2026-11-01T01:00:00.000Z',2000,0],['store-a','REFUNDING','2026-11-01T01:00:00.000Z',8000,0],['store-a','CANCELLED','2026-11-01T01:00:00.000Z',10000,0],['store-a','PAID','2026-11-02T00:00:00.000Z',9900,0],['store-a','PAID','2026-11-01T01:00:00.000Z',9900,1],['store-b','PAID','2026-11-01T00:00:00.000Z',9900,0]]) insert.run(...row as (string|number)[]);
  let reads = 0;
  const service = new OrdersQueryService({ $transaction: async (work: any, options: any) => {
    assert.equal(options.isolationLevel, 'RepeatableRead');
    return work({ order: { groupBy: async ({ where }: any) => {
      reads++; const clauses = ['storeId=?','isDeleted=0'], values: any[] = [where.storeId.in[0]];
      if (where.status) { clauses.push('status=?'); values.push(where.status); }
      for (const [key, operator] of [['gte','>='],['lt','<'],['lte','<=']]) if (where.createdAt?.[key!]) { clauses.push(`createdAt${operator}?`); values.push(where.createdAt[key!].toISOString()); }
      return db.prepare(`SELECT status,COUNT(*) AS n,SUM(cents) AS amount FROM orders WHERE ${clauses.join(' AND ')} GROUP BY status`).all(...values).map((row: any) => ({ status: row.status, _count: { _all: row.n }, _sum: { payableAmount: new Prisma.Decimal(row.amount).div(100) } }));
    } } });
  } } as never, { mode: 'multi', resolveStoreIds: (ids: string[]) => ids } as never);
  return { service, db, reads: () => reads };
}
const period = { startDate: '2026-11-01T00:00:00.000Z', endBefore: '2026-11-02T00:00:00.000Z', page: 1, pageSize: 20 };
test('order summary intersects status filters instead of replacing them and uses exact scoped amounts', async () => {
  const f = fixture(); try {
    const all = await f.service.getOrderSummary(period, { storeIds: ['store-a'] }); assert.equal(all.total_count,4); assert.equal(all.total_amount,112.34); assert.equal(all.paid_count,2);
    const paid = await f.service.getOrderSummary({ ...period, status:'PAID' }, { storeIds: ['store-a'] });
    assert.deepEqual(paid, { total_count:1, pending_payment_count:0, paid_count:1, refunding_count:0, refunded_count:0, total_amount:12.34 });
    const refund = await f.service.getOrderSummary({ ...period, status:'REFUNDING' }, { storeIds: ['store-a'] }); assert.equal(refund.total_count,1); assert.equal(refund.paid_count,0); assert.equal(refund.total_amount,80);
  } finally { f.db.close(); }
});
test('legacy inclusive endDate is retained while ambiguous or reversed new bounds are rejected', async () => {
  const f = fixture(); try {
    const result = await f.service.getOrderSummary({ ...period, endBefore:undefined, endDate:period.endBefore, status:'PAID' }, { storeIds:['store-a'] }); assert.equal(result.total_count,2); assert.equal(result.total_amount,111.34);
    const reads = f.reads();
    await assert.rejects(f.service.getOrderSummary({ ...period, endDate:period.endBefore }, { storeIds:['store-a'] }),/orders.invalidPeriod/);
    await assert.rejects(f.service.getOrderSummary({ ...period, endBefore:period.startDate }, { storeIds:['store-a'] }),/orders.invalidPeriod/); assert.equal(f.reads(),reads);
  } finally { f.db.close(); }
});
test('order DTO bounds protect shared filters and notes without accepting an ambiguous exclusive date', () => {
  for (const query of [{ endBefore:'2026-11-01' },{ keyword:'x'.repeat(121) },{ page:1000001 }]) assert.ok(validateSync(plainToInstance(QueryOrdersDto,query)).length);
  assert.ok(validateSync(plainToInstance(UpdateOrderStatusDto,{ status:'PAID', note:'x'.repeat(192) })).length);
});
