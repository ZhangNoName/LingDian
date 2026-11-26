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
  for (const query of [{ endBefore:'2026-11-01' },{ keyword:'x'.repeat(121) },{ page:1000001 }, { orderSource: 'UNKNOWN' }, { storeId: ' ' }, { storeId: ['store-a'] }]) {
    assert.ok(validateSync(plainToInstance(QueryOrdersDto, query)).length);
  }
  const scoped = plainToInstance(QueryOrdersDto, { orderSource: 'APP', storeId: ' store-a ' });
  assert.equal(scoped.storeId, 'store-a');
  assert.equal(validateSync(scoped).length, 0);
  assert.ok(validateSync(plainToInstance(UpdateOrderStatusDto,{ status:'PAID', note:'x'.repeat(192) })).length);
  assert.equal(validateSync(plainToInstance(UpdateOrderStatusDto, { status: 'PAID', expectedStatus: 'PENDING_PAYMENT', expectedPaymentChannel: 'CASH' })).length, 0);
  for (const invalid of [{ expectedStatus: 'OTHER' }, { expectedStatus: null }, { expectedPaymentChannel: null }]) {
    assert.ok(validateSync(plainToInstance(UpdateOrderStatusDto, { status: 'PAID', ...invalid })).length);
  }
});

test('merchant list and detail expose current manual transitions from the order policy', async () => {
  const time = new Date('2026-11-01T00:00:00.000Z');
  const baseOrder = {
    id: 'cash', orderNo: 'LD1', storeId: 'store-a', store: { id: 'store-a', name: 'Store A', code: 'A' },
    status: 'PENDING_PAYMENT', paymentChannel: 'CASH', paymentRequired: true, isDeleted: false,
    items: [], statusLogs: [], paymentIntents: [], createdAt: time, updatedAt: time,
  };
  const orders = [
    baseOrder,
    { ...baseOrder, id: 'online', paymentChannel: 'WECHAT' },
    { ...baseOrder, id: 'active', paymentChannel: 'WECHAT', paymentIntents: [{ id: 'attempt' }] },
    { ...baseOrder, id: 'paid', status: 'PAID' },
    { ...baseOrder, id: 'paid-online', status: 'PAID', paymentChannel: 'WECHAT' },
    { ...baseOrder, id: 'preparing', status: 'PREPARING', paymentRequired: false },
    { ...baseOrder, id: 'cancelled', status: 'CANCELLED' },
  ];
  const service = new OrdersQueryService({
    order: {
      findMany: async ({ include }: Prisma.OrderFindManyArgs) => {
        assert.deepEqual(include?.paymentIntents, {
          where: { status: { in: ['CREATED', 'PENDING', 'PROCESSING', 'SUCCEEDED'] } }, select: { id: true }, take: 1,
        });
        return orders;
      },
      count: async () => orders.length,
      findFirst: async ({ where }: Prisma.OrderFindFirstArgs) => orders.find(({ id }) => id === where?.id),
    },
  } as never, { mode: 'multi', resolveStoreIds: (ids: string[]) => ids } as never);

  const scope = { storeIds: ['store-a'], includeManualTransitions: true };
  const page = await service.getOrders({ page: 1, pageSize: 20 }, scope);
  assert.deepEqual(page.items.map(order => order.allowed_statuses), [
    ['PAID', 'TIMED_OUT', 'CANCELLED', 'FAILED'],
    ['TIMED_OUT', 'CANCELLED', 'FAILED'],
    [],
    ['PREPARING', 'READY', 'COMPLETED', 'REFUNDING', 'REFUNDED'],
    ['PREPARING', 'READY', 'COMPLETED'],
    ['READY', 'COMPLETED'],
    [],
  ]);
  for (const order of page.items) {
    assert.deepEqual((await service.getOrderDetail(order.id, scope)).allowed_statuses, order.allowed_statuses);
  }
  assert.equal((await service.getOrderDetail('paid', { customerUserId: 'customer' })).allowed_statuses, undefined);
});

test('merchant reads include only the linked nickname and match it in both the list and summary filters', async () => {
  const time = new Date('2026-11-01T00:00:00.000Z');
  const order = {
    id: 'order-a', orderNo: 'LD1', storeId: 'store-a', store: { id: 'store-a', name: 'Store A', code: 'A' },
    customerName: 'Recipient', customerMobile: 'test-phone', customerUser: { nickname: '小栗子' },
    items: [], statusLogs: [], createdAt: time, updatedAt: time,
  };
  const list: Prisma.OrderFindManyArgs[] = [];
  const details: Prisma.OrderFindFirstArgs[] = [];
  const counts: Prisma.OrderCountArgs[] = [];
  const summaries: Prisma.OrderGroupByArgs[] = [];
  const service = new OrdersQueryService({
    order: {
      findMany: async (args: Prisma.OrderFindManyArgs) => { list.push(args); return [order, { ...order, id: 'order-b', customerUser: null }]; },
      count: async (args: Prisma.OrderCountArgs) => { counts.push(args); return 2; },
      findFirst: async (args: Prisma.OrderFindFirstArgs) => { details.push(args); return order; },
    },
    $transaction: async (work: (transaction: unknown) => unknown) => work({
      order: { groupBy: async (args: Prisma.OrderGroupByArgs) => { summaries.push(args); return []; } },
    }),
  } as never, { mode: 'multi', resolveStoreIds: (ids: string[]) => ids } as never);

  const scope = { storeIds: ['store-a'], includeCustomerNickname: true };
  const filter = { keyword: '小栗子', page: 1, pageSize: 20, orderSource: 'APP' as const, storeId: 'store-a' };
  const page = await service.getOrders(filter, scope);
  assert.deepEqual(page.items.map(({ customer_nickname }) => customer_nickname), ['小栗子', null]);
  assert.equal(page.items[0]?.customer_name, 'Recipient');
  assert.deepEqual(list[0]?.include?.customerUser, { select: { nickname: true } });
  assert.deepEqual(list[0]?.where?.storeId, { in: ['store-a'] });
  assert.deepEqual(list[0]?.where?.AND, { storeId: 'store-a' });
  assert.equal(list[0]?.where?.orderSource, 'APP');
  assert.deepEqual(list[0]?.where?.OR?.find((clause) => clause.customerUser), {
    customerUser: { is: { nickname: { contains: '小栗子' } } },
  });
  assert.deepEqual(counts[0]?.where, list[0]?.where);
  await service.getOrderSummary(filter, scope);
  assert.deepEqual(summaries[0]?.where, list[0]?.where);

  const detail = await service.getOrderDetail('order-a', scope);
  assert.equal(detail.customer_nickname, '小栗子');
  assert.equal(detail.customer_name, 'Recipient');
  assert.deepEqual(details[0]?.include?.customerUser, { select: { nickname: true } });
  assert.deepEqual(details[0]?.where, { id: 'order-a', storeId: { in: ['store-a'] } });

  const customerPage = await service.getOrders(filter, { customerUserId: 'user-a' });
  assert.equal('customer_nickname' in customerPage.items[0]!, false);
  assert.equal(list[1]?.include?.customerUser, undefined);
  assert.equal(list[1]?.where?.customerUserId, 'user-a');
  assert.equal(list[1]?.where?.OR?.some((clause) => Boolean(clause.customerUser)), false);
});
