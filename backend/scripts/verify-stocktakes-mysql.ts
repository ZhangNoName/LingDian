import assert = require('node:assert/strict');
import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { AuthenticatedUser } from '../src/common/auth/authenticated-user.type';
import type { StocktakeRecord } from '@lingdian/contracts';
import { MultiStoreContextResolver } from '../src/modules/stores/store-context.resolver';
import { MerchantStoreScope } from '../src/modules/merchant/merchant-store-scope';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { InventoryReportService } from '../src/modules/inventory/inventory-report.service';
import { StocktakeService } from '../src/modules/inventory/stocktakes/stocktake.service';
export async function verifyStocktakes(db: PrismaService) {
  const storeId = 'stocktake-store-a',
    foreign = 'stocktake-store-b';
  for (const id of [storeId, foreign]) await db.store.create({ data: { id, code: id, name: id } });
  const scope = new MerchantStoreScope(
      new MultiStoreContextResolver(db, new ConfigService({ store: { primaryStoreId: storeId } })),
    ),
    service = new StocktakeService(db, scope),
    inventory = new InventoryService(db, scope),
    reports = new InventoryReportService(db, scope);
  const user: AuthenticatedUser = {
    userId: 'stocktake-merchant',
    sessionId: 'synthetic-session',
    audience: 'merchant-api',
    roles: ['MERCHANT'],
    merchantStoreIds: [storeId],
  };
  const a = await inventory.create(user, storeId, { code: 'F', name: 'Flour', unit: 'kg', reorderPoint: 5 }),
    b = await inventory.create(user, storeId, { code: 'M', name: 'Milk', unit: 'l', reorderPoint: 5 });
  for (const [item, amount] of [
    [a, 10],
    [b, 4],
  ] as const)
    await inventory.adjust(user, storeId, item.id, {
      kind: 'RECEIVE',
      amount,
      expectedVersion: 0,
      requestId: 'stocktake-start-' + item.code,
      reason: 'Synthetic opening delivery',
    });
  const foreignItem = await db.inventoryItem.create({
    data: { storeId: foreign, code: 'F', name: 'Foreign flour', unit: 'kg' },
  });
  const create = (requestId: string, itemIds = [a.id, b.id]) =>
    service.create(user, storeId, { requestId, title: 'Closing count', note: 'Synthetic shift count', itemIds });
  const input = {
    requestId: 'stocktake-create-replay',
    title: 'Closing count',
    note: 'Synthetic shift count',
    itemIds: [a.id, b.id],
  };
  const concurrent = await Promise.all([
    service.create(user, storeId, input),
    service.create(user, storeId, { ...input, itemIds: [b.id, a.id] }),
  ]);
  assert.equal(concurrent[0].id, concurrent[1].id);
  assert.equal(await db.inventoryStocktake.count({ where: { storeId } }), 1);
  let row = concurrent[0];
  assert.ok(row.lines.every((line) => line.countedQuantity === null));
  assert.equal((await db.inventoryItem.findUniqueOrThrow({ where: { id: a.id } })).quantity, 10000);
  await assert.rejects(service.create(user, storeId, { ...input, title: 'Changed' }), /requestConflict/);
  await assert.rejects(create('stocktake-foreign-item', [foreignItem.id]), /itemUnavailable/);
  await assert.rejects(service.detail(user, foreign, row.id));
  await assert.rejects(service.detail(user, storeId, 'missing'), /notFound/);
  const counts = (record: StocktakeRecord, quantity: number | null) =>
    record.lines.map((line) => ({ lineId: line.id, countedQuantity: quantity }));
  row = await service.save(user, storeId, row.id, {
    expectedVersion: 0,
    lines: row.lines.map((line, i) => ({ lineId: line.id, countedQuantity: i === 0 ? null : 0 })),
  });
  assert.equal(row.lines[0].countedQuantity, null);
  assert.equal(row.lines[1].countedQuantity, 0);
  await assert.rejects(service.post(user, storeId, row.id, { expectedVersion: 1 }), /incomplete/);
  assert.equal((await service.detail(user, storeId, row.id)).version, 1);
  await assert.rejects(service.save(user, storeId, row.id, { expectedVersion: 0, lines: counts(row, 1) }), /stale/);
  await assert.rejects(
    service.save(user, storeId, row.id, {
      expectedVersion: 1,
      lines: [{ lineId: 'foreign-line', countedQuantity: 1 }],
    }),
    /invalidLines/,
  );
  assert.equal((await service.detail(user, storeId, row.id)).version, 1);
  row = await service.save(user, storeId, row.id, {
    expectedVersion: 1,
    lines: row.lines.map((line) => ({ lineId: line.id, countedQuantity: line.itemId === a.id ? 6.125 : 5.5 })),
  });
  const posted = await Promise.allSettled([
    service.post(user, storeId, row.id, { expectedVersion: 2 }),
    service.post(user, storeId, row.id, { expectedVersion: 2 }),
  ]);
  assert.ok(posted.some((result) => result.status === 'fulfilled'));
  row = await service.post(user, storeId, row.id, { expectedVersion: 2 });
  assert.equal(row.status, 'POSTED');
  assert.equal(row.version, 3);
  assert.equal(row.postedBy, user.userId);
  assert.equal(await db.inventoryMovement.count({ where: { stocktakeId: row.id } }), 2);
  assert.equal(
    await db.authAuditLog.count({
      where: { event: 'STOCKTAKE_POSTED', metadata: { path: '$.stocktakeId', equals: row.id } },
    }),
    1,
  );
  assert.equal((await db.inventoryItem.findUniqueOrThrow({ where: { id: a.id } })).quantity, 6125);
  assert.equal((await db.inventoryItem.findUniqueOrThrow({ where: { id: b.id } })).quantity, 5500);
  assert.equal(await db.inventoryAlert.count({ where: { storeId, status: { in: ['OPEN', 'ACKNOWLEDGED'] } } }), 0);
  await assert.rejects(service.cancel(user, storeId, row.id, { expectedVersion: 3 }), /closed/);
  await assert.rejects(service.save(user, storeId, row.id, { expectedVersion: 3, lines: counts(row, 1) }), /closed/);
  const history = await inventory.history(user, storeId, { page: 1, pageSize: 100, kind: 'COUNT' });
  assert.equal(history.items.filter((line) => line.stocktakeId === row.id).length, 2);
  const report = await reports.report(user, storeId, {
    startAt: new Date(Date.now() - 60000).toISOString(),
    endAt: new Date(Date.now() + 60000).toISOString(),
  });
  assert.equal(report.rows.find((line) => line.itemId === a.id)!.countLoss, 3.875);
  assert.equal(report.rows.find((line) => line.itemId === b.id)!.countGain, 1.5);
  // Stock changes invalidate the entire saved count, never overwriting a concurrent receipt.
  let stale = await create('stocktake-stock-changed');
  stale = await service.save(user, storeId, stale.id, { expectedVersion: 0, lines: counts(stale, 3) });
  await inventory.adjust(user, storeId, a.id, {
    kind: 'RECEIVE',
    amount: 1,
    expectedVersion: 2,
    requestId: 'stocktake-late-receipt',
    reason: 'Arrived during count',
  });
  await assert.rejects(service.post(user, storeId, stale.id, { expectedVersion: 1 }), /stockChanged/);
  assert.equal((await service.detail(user, storeId, stale.id)).version, 1);
  assert.equal(await db.inventoryMovement.count({ where: { stocktakeId: stale.id } }), 0);
  stale = await service.refresh(user, storeId, stale.id, { expectedVersion: 1 });
  assert.ok(stale.lines.every((line) => line.countedQuantity === null && line.itemVersion === line.currentVersion));
  assert.equal(stale.lines.find((line) => line.itemId === a.id)!.expectedQuantity, 7.125);
  stale = await service.cancel(user, storeId, stale.id, { expectedVersion: 2 });
  assert.equal(stale.status, 'CANCELLED');
  assert.equal((await service.cancel(user, storeId, stale.id, { expectedVersion: 2 })).version, 3);
  assert.equal(await db.inventoryMovement.count({ where: { stocktakeId: stale.id } }), 0);
  await assert.rejects(service.post(user, storeId, stale.id, { expectedVersion: 3 }), /closed/);
  // A late-line reservation failure rolls back earlier line writes and alerts as well.
  let reserved = await create('stocktake-reserved-limit');
  const last = reserved.lines[reserved.lines.length - 1]!;
  await db.inventoryItem.update({
    where: { id: last.itemId },
    data: {
      reservedQuantity: 1000,
      availableQuantity: Math.round(last.currentQuantity * 1000) - 1000,
      version: { increment: 1 },
    },
  });
  reserved = await service.refresh(user, storeId, reserved.id, { expectedVersion: 0 });
  reserved = await service.save(user, storeId, reserved.id, { expectedVersion: 1, lines: counts(reserved, 0.5) });
  const before = await db.inventoryItem.findMany({ where: { storeId }, orderBy: { id: 'asc' } });
  await assert.rejects(service.post(user, storeId, reserved.id, { expectedVersion: 2 }), /reserved/);
  assert.deepEqual(await db.inventoryItem.findMany({ where: { storeId }, orderBy: { id: 'asc' } }), before);
  assert.equal(await db.inventoryMovement.count({ where: { stocktakeId: reserved.id } }), 0);
  assert.equal((await service.detail(user, storeId, reserved.id)).version, 2);
  await db.inventoryItem.update({
    where: { id: last.itemId },
    data: {
      reservedQuantity: 0,
      availableQuantity: Math.round(last.currentQuantity * 1000),
      version: { increment: 1 },
    },
  });
  let atomic = await create('stocktake-audit-rollback');
  atomic = await service.save(user, storeId, atomic.id, { expectedVersion: 0, lines: counts(atomic, 1) });
  const auditDb = new Proxy(db, {
    get(target, key) {
      if (key === '$transaction')
        return (work: any, options: any) =>
          target.$transaction(
            (tx: any) =>
              work(
                new Proxy(tx, {
                  get(t, k) {
                    if (k === 'authAuditLog')
                      return {
                        create: (args: any) => {
                          if (args.data.event === 'STOCKTAKE_POSTED') throw Error('forced audit failure');
                          return t.authAuditLog.create(args);
                        },
                      };
                    return Reflect.get(t, k);
                  },
                }),
              ),
            options,
          );
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as PrismaService;
  const alertsBeforeAtomic = await db.inventoryAlert.findMany({ where: { storeId }, orderBy: { id: 'asc' } });
  const beforeAtomic = await db.inventoryItem.findMany({ where: { storeId }, orderBy: { id: 'asc' } });
  await assert.rejects(
    new StocktakeService(auditDb, scope).post(user, storeId, atomic.id, { expectedVersion: 1 }),
    /forced audit failure/,
  );
  assert.deepEqual(await db.inventoryItem.findMany({ where: { storeId }, orderBy: { id: 'asc' } }), beforeAtomic);
  assert.equal(await db.inventoryMovement.count({ where: { stocktakeId: atomic.id } }), 0);
  assert.equal((await service.detail(user, storeId, atomic.id)).status, 'DRAFT');
  assert.deepEqual(await db.inventoryAlert.findMany({ where: { storeId }, orderBy: { id: 'asc' } }), alertsBeforeAtomic);
  await assert.rejects(
    db.inventoryStocktakeLine.create({
      data: {
        storeId,
        stocktakeId: atomic.id,
        itemId: foreignItem.id,
        itemName: 'Foreign',
        itemCode: 'F',
        unit: 'kg',
        expectedQuantity: 0,
        reservedQuantity: 0,
        itemVersion: 0,
      },
    }),
  );
  const both = { ...user, merchantStoreIds: [storeId, foreign] };
  const foreignCount = await service.create(both, foreign, { ...input, itemIds: [foreignItem.id] });
  assert.notEqual(foreignCount.id, row.id, 'Creation keys belong to one store');
  await assert.rejects(service.detail(both, storeId, foreignCount.id), /notFound/);
  await assert.rejects(service.post(both, storeId, foreignCount.id, { expectedVersion: 0 }), /notFound/);
  await assert.rejects(service.save(both, storeId, foreignCount.id, { expectedVersion: 0, lines: counts(foreignCount, 0) }), /notFound/);
  const listed = await service.list(user, storeId, { page: 1, pageSize: 20, status: 'POSTED', keyword: 'Closing' });
  assert.equal(listed.total, 1);
  assert.equal(listed.items[0].id, row.id);
  console.log(
    'PASS MySQL stocktakes: scoped creation replay, nullable/zero counts, stale draft and stock versions, concurrent/replayed posting once, COUNT history/report/alerts, recount clears counts, reservation and audit rollback, terminal cancellation and composite tenant foreign keys.',
  );
}
