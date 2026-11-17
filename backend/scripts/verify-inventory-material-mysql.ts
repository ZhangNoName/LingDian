import assert = require('node:assert/strict');
import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { AuthenticatedUser } from '../src/common/auth/authenticated-user.type';
import { MultiStoreContextResolver } from '../src/modules/stores/store-context.resolver';
import { MerchantStoreScope } from '../src/modules/merchant/merchant-store-scope';
import { InventoryMaterialService } from '../src/modules/inventory/inventory-material.service';
import { InventoryLifecycleService } from '../src/modules/inventory/inventory-lifecycle.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { PurchasingService } from '../src/modules/inventory/purchasing/purchasing.service';
import { StocktakeService } from '../src/modules/inventory/stocktakes/stocktake.service';
export async function verifyInventoryMaterial(db: PrismaService) {
  const storeId = 'material-profile-a', foreign = 'material-profile-b';
  for (const id of [storeId, foreign]) await db.store.create({ data: { id, code: id, name: id } });
  const scope = new MerchantStoreScope(new MultiStoreContextResolver(db, new ConfigService({ store: { primaryStoreId: storeId } }))), service = new InventoryMaterialService(db, scope), inventory = new InventoryService(db, scope), lifecycle = new InventoryLifecycleService(db, scope), purchases = new PurchasingService(db, scope), stocktakes = new StocktakeService(db, scope);
  const user: AuthenticatedUser = { userId: 'profile-actor', sessionId: 'synthetic-session', audience: 'merchant-api', roles: ['MERCHANT'], merchantStoreIds: [storeId, foreign] };
  const item = await inventory.create(user, storeId, { code: 'NAME', name: 'Old material', unit: 'kg', reorderPoint: 1 });
  const supplier = await db.supplier.create({ data: { storeId, code: 'P', name: 'Supplier' } });
  const po = await purchases.create(user, storeId, { requestId: 'profile-purchase', supplierId: supplier.id, note: 'Historical name', lines: [{ itemId: item.id, quantity: 1.125, unitPrice: 2 }] });
  const draft = await stocktakes.create(user, storeId, { requestId: 'profile-stocktake', title: 'Historical count', note: 'Historical name', itemIds: [item.id] });
  const alertBefore = await db.inventoryAlert.findUniqueOrThrow({ where: { activeItemKey: item.id } });
  const body = { name: '=New material', expectedVersion: 0, reason: 'Correct supplier label' };
  const concurrent = await Promise.all([1, 2].map(() => service.rename(user, storeId, item.id, body)));
  assert.deepEqual(concurrent[0], concurrent[1]); assert.equal(concurrent[0].version, 1);
  assert.deepEqual([concurrent[0].quantity, concurrent[0].reservedQuantity, concurrent[0].availableQuantity, concurrent[0].reorderPoint, concurrent[0].code, concurrent[0].unit], [0, 0, 0, 1, 'NAME', 'kg']);
  assert.equal(await db.inventoryMaterialChange.count({ where: { storeId, itemId: item.id } }), 1);
  const record = await db.inventoryMaterialChange.findFirstOrThrow({ where: { storeId, itemId: item.id } });
  assert.deepEqual([record.nameBefore, record.nameAfter, record.actorId, record.reason, record.versionBefore], ['Old material', body.name, user.userId, body.reason, 0]);
  assert.deepEqual(await db.inventoryAlert.findUniqueOrThrow({ where: { id: alertBefore.id } }), alertBefore);
  assert.equal(await db.inventoryMovement.count({ where: { storeId, itemId: item.id } }), 0);
  assert.equal((await purchases.detail(user, storeId, po.id)).lines[0].itemName, 'Old material');
  assert.equal((await stocktakes.detail(user, storeId, draft.id)).lines[0].itemName, 'Old material');
  const counted = await stocktakes.save(user, storeId, draft.id, { expectedVersion: 0, lines: [{ lineId: draft.lines[0].id, countedQuantity: 0 }] });
  await assert.rejects(stocktakes.post(user, storeId, draft.id, { expectedVersion: counted.version }), /stockChanged/);
  await assert.rejects(service.rename({ ...user, userId: 'other' }, storeId, item.id, body), /stale/);
  await assert.rejects(service.rename(user, storeId, item.id, { ...body, reason: 'Other reason' }), /stale/);
  const unchanged = await service.rename(user, storeId, item.id, { ...body, expectedVersion: 1 });
  assert.equal(unchanged.version, 1); assert.equal(await db.inventoryMaterialChange.count({ where: { itemId: item.id } }), 1);
  await inventory.adjust(user, storeId, item.id, { requestId: 'profile-quantity-write', kind: 'RECEIVE', amount: 5.125, expectedVersion: 1, reason: 'Real movement' });
  await assert.rejects(service.rename(user, storeId, item.id, body), /stale/);
  const beforeFail = await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } }), changeCount = await db.inventoryMaterialChange.count({ where: { itemId: item.id } });
  const failing = new InventoryMaterialService({ $transaction: (fn: (tx: unknown) => unknown, options: unknown) => db.$transaction(async tx => fn({ ...tx, authAuditLog: { ...tx.authAuditLog, create: async () => { throw Error('synthetic name audit failure'); } } }), options as never) } as unknown as PrismaService, scope);
  await assert.rejects(failing.rename(user, storeId, item.id, { ...body, name: 'Must roll back', expectedVersion: 2 }), /synthetic name audit/);
  assert.deepEqual(await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } }), beforeFail);
  assert.equal(await db.inventoryMaterialChange.count({ where: { itemId: item.id } }), changeCount);
  const beforeRead = await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
  const page = await service.changes(user, storeId, item.id, { kind: 'ALL', page: 1 });
  assert.equal(page.items.length, 1); assert.equal(page.item.name, body.name); assert.equal(page.items[0].reason, body.reason);
  assert.deepEqual(await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } }), beforeRead);
  await assert.rejects(service.changes(user, foreign, item.id, { kind: 'ALL', page: 1 }), /notFound/);
  await assert.rejects(service.rename(user, foreign, item.id, body), /notFound/);
  await assert.rejects(service.changes({ ...user, merchantStoreIds: [foreign] }, storeId, item.id, { kind: 'ALL', page: 1 }));
  await assert.rejects(db.inventoryMaterialChange.create({ data: { storeId: foreign, itemId: item.id, kind: 'NAME', reason: 'Foreign direct insert' } }), /Foreign key constraint/);
  const zero = await inventory.create(user, storeId, { code: 'LIFE', name: 'Lifecycle', unit: 'kg', reorderPoint: 0 });
  await lifecycle.change(user, storeId, zero.id, { isActive: false, expectedVersion: 0, reason: 'No longer used' });
  await assert.rejects(service.rename(user, storeId, zero.id, { ...body, expectedVersion: 1 }), /inactive/);
  await lifecycle.change(user, storeId, zero.id, { isActive: true, expectedVersion: 1, reason: 'Resume' });
  const life = await service.changes(user, storeId, zero.id, { kind: 'ALL', page: 1 });
  assert.equal(life.total, 2); assert.deepEqual(new Set(life.items.map(row => row.kind)), new Set(['ARCHIVE', 'RESTORE']));
  const paged = await inventory.create(user, storeId, { code: 'PAGED', name: 'Paged history', unit: 'kg', reorderPoint: 0 });
  await db.inventoryMaterialChange.createMany({ data: Array.from({ length: 26 }, (_,index) => ({ id: 'profile-history-' + index.toString().padStart(2, '0'), storeId, itemId: paged.id, kind: index % 2 ? 'RESTORE' : 'ARCHIVE', isActiveBefore: !(index % 2), isActiveAfter: !!(index % 2), reason: 'Synthetic pagination', versionBefore: index, createdAt: new Date('2026-11-18T00:00:00Z') })) });
  const first = await service.changes(user, storeId, paged.id, { kind: 'ALL', page: 1 }), last = await service.changes(user, storeId, paged.id, { kind: 'ALL', page: 999 });
  assert.equal(first.items.length, 20); assert.equal(last.items.length, 6); assert.equal(last.page, 2); assert.equal(new Set([...first.items, ...last.items].map(row => row.id)).size, 26);
  assert.equal((await service.changes(user, storeId, paged.id, { kind: 'ARCHIVE', page: 1 })).total, 13);
  for (const other of ['stock', 'lifecycle'] as const) {
    const race = await inventory.create(user, storeId, { code: 'RACE-' + other, name: 'Concurrent material', unit: 'kg', reorderPoint: 0 });
    const results = await Promise.allSettled([
      service.rename(user, storeId, race.id, { name: 'Renamed concurrently', expectedVersion: 0, reason: 'Concurrent metadata edit' }),
      other === 'stock' ? inventory.adjust(user, storeId, race.id, { kind: 'RECEIVE', amount: 1, expectedVersion: 0, requestId: 'profile-race-stock', reason: 'Concurrent receipt' }) : lifecycle.change(user, storeId, race.id, { isActive: false, expectedVersion: 0, reason: 'Concurrent archive' }),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal((await db.inventoryItem.findUniqueOrThrow({ where: { id: race.id } })).version, 1);
  }
  console.log('PASS MySQL material profiles: scoped name-only mutation, concurrent exact replay once, no-op/version/actor/reason guards, competing stock/lifecycle writes, audit rollback, unchanged stock/alerts, historical purchasing/count names, readonly indexed paged history, lifecycle records and composite tenant foreign key.');
}
