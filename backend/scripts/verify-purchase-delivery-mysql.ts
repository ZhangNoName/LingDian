import assert = require('node:assert/strict');
import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { AuthenticatedUser } from '../src/common/auth/authenticated-user.type';
import { MultiStoreContextResolver } from '../src/modules/stores/store-context.resolver';
import { MerchantStoreScope } from '../src/modules/merchant/merchant-store-scope';
import { PurchasingService } from '../src/modules/inventory/purchasing/purchasing.service';
export async function verifyPurchaseDelivery(db: PrismaService) {
  const storeId = 'delivery-store-a', foreign = 'delivery-store-b';
  for (const id of [storeId, foreign]) {
    await db.store.create({ data: { id, code: id, name: id } });
    await db.supplier.create({ data: { id: id + '-supplier', storeId: id, code: 'S', name: 'Delivery supplier' } });
    for (const suffix of ['flour', 'oil']) await db.inventoryItem.create({ data: { id: id + '-' + suffix, storeId: id, code: suffix, name: suffix, unit: suffix === 'flour' ? 'kg' : 'L' } });
  }
  const scope = new MerchantStoreScope(new MultiStoreContextResolver(db, new ConfigService({ store: { primaryStoreId: storeId } }))), service = new PurchasingService(db, scope);
  const user: AuthenticatedUser = { userId: 'delivery-buyer', sessionId: 'synthetic-session', audience: 'merchant-api', roles: ['MERCHANT'], merchantStoreIds: [storeId, foreign] };
  const cutoff = '2026-11-18T00:00:00+08:00', before = '2026-11-17T15:59:59.999Z';
  async function create(requestId: string, expectedAt?: string, store = storeId, multiple = false) {
    return service.create(user, store, { requestId: 'delivery-' + requestId, supplierId: store + '-supplier', note: requestId, ...(expectedAt ? { expectedAt } : {}), lines: ['flour', ...(multiple ? ['oil'] : [])].map(suffix => ({ itemId: store + '-' + suffix, quantity: 1, unitPrice: 2 })) });
  }
  const early = await create('early', before), boundary = await create('boundary', cutoff), later = await create('later', '2026-11-17T16:00:00.001Z'), undated = await create('undated');
  const partial = await create('partial', before, storeId, true);
  await service.receive(user, storeId, partial.id, { requestId: 'delivery-partial-receipt', expectedVersion: 0, note: 'Flour fully received; oil outstanding', lines: [{ lineId: partial.lines.find(line => line.itemCode === 'flour')!.id, quantity: 1 }] });
  const full = await create('full', before);
  await service.receive(user, storeId, full.id, { requestId: 'delivery-full-receipt', expectedVersion: 0, note: 'Fully received', lines: [{ lineId: full.lines[0].id, quantity: 1 }] });
  const cancelled = await create('cancelled', before);
  await service.cancel(user, storeId, cancelled.id, { expectedVersion: 0, note: 'Cancelled remaining' });
  for (let i = 0; i < 21; i++) await create('bulk-' + String(i).padStart(2, '0'), before);
  const foreignOrder = await create('foreign', before, foreign);
  const query = { page: 1, pageSize: 20, status: 'ALL', delivery: 'BEFORE' as const, expectedBefore: cutoff };
  const balances = await db.inventoryItem.findMany({ where: { storeId }, orderBy: { id: 'asc' } });
  const first = await service.list(user, storeId, query), second = await service.list(user, storeId, { ...query, page: 2 });
  assert.equal(first.total, 23); assert.equal(first.items.length, 20); assert.equal(second.total, 23); assert.equal(second.items.length, 3);
  const ids = [...first.items, ...second.items].map(order => order.id);
  assert.equal(new Set(ids).size, 23); assert.ok(ids.includes(early.id)); assert.ok(ids.includes(partial.id));
  for (const id of [boundary.id, later.id, undated.id, full.id, cancelled.id, foreignOrder.id]) assert.ok(!ids.includes(id));
  const pending = await service.list(user, storeId, { ...query, pendingItemId: storeId + '-flour' });
  assert.equal(pending.total, 22); assert.ok(!pending.items.some(order => order.id === partial.id));
  assert.equal((await service.list(user, storeId, { ...query, status: 'RECEIVED' })).total, 0, 'Delivery predicate must compose with the requested status, not replace it.');
  assert.equal((await service.list(user, storeId, { ...query, keyword: early.orderNo })).total, 1);
  const noDate = await service.list(user, storeId, { page: 1, pageSize: 20, delivery: 'UNDATED' });
  assert.deepEqual(noDate.items.map(order => order.id), [undated.id]);
  assert.equal((await service.list(user, storeId, { page: 1, pageSize: 20, status: 'ALL' })).total, 28);
  await assert.rejects(service.list({ ...user, merchantStoreIds: [storeId] }, foreign, query));
  await assert.rejects(service.list(user, storeId, { ...query, expectedBefore: undefined }), /invalidDelivery/);
  assert.deepEqual(await db.inventoryItem.findMany({ where: { storeId }, orderBy: { id: 'asc' } }), balances);
  console.log('Verified indexed delivery cutoff boundaries, NULL dates, active-only follow-up, complete pagination, material/status/search composition, no stock writes and tenant isolation.');
}
