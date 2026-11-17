import assert = require('node:assert/strict');
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@lingdian/db';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { AuthenticatedUser } from '../src/common/auth/authenticated-user.type';
import { MultiStoreContextResolver } from '../src/modules/stores/store-context.resolver';
import { MerchantStoreScope } from '../src/modules/merchant/merchant-store-scope';
import { InventoryTrendService } from '../src/modules/inventory/trend/inventory-trend.service';
import { InventoryReportService } from '../src/modules/inventory/inventory-report.service';
export async function verifyInventoryTrend(db: PrismaService) {
  const storeId = 'trend-store-a',
    foreign = 'trend-store-b';
  for (const id of [storeId, foreign]) await db.store.create({ data: { id, code: id, name: id } });
  const scope = new MerchantStoreScope(
      new MultiStoreContextResolver(db, new ConfigService({ store: { primaryStoreId: storeId } })),
    ),
    service = new InventoryTrendService(db, scope),
    reports = new InventoryReportService(db, scope);
  const user: AuthenticatedUser = {
    userId: 'trend-user',
    sessionId: 'synthetic-session',
    audience: 'merchant-api',
    roles: ['MERCHANT'],
    merchantStoreIds: [storeId, foreign],
  };
  const item = await db.inventoryItem.create({
    data: {
      storeId,
      code: 'TREND',
      name: 'Daily material',
      unit: 'kg',
      createdAt: new Date('2026-03-06T05:00:00Z'),
    },
  });
  let quantity = 0,
    reserved = 0;
  const samples = [
    { at: '2026-03-06T10:00:00Z', kind: 'RECEIVE', amount: 10000, quantity: 10000, reserved: 0 },
    { at: '2026-03-07T10:00:00Z', kind: 'RESERVE', amount: 3000, quantity: 10000, reserved: 3000 },
    { at: '2026-03-08T07:00:00Z', kind: 'RECEIVE', amount: 2000, quantity: 12000, reserved: 3000 },
    { at: '2026-03-09T10:00:00Z', kind: 'ISSUE', amount: 4000, quantity: 8000, reserved: 3000 },
    { at: '2026-03-09T12:00:00Z', kind: 'LOSS', amount: 1000, quantity: 7000, reserved: 3000 },
    { at: '2026-03-09T13:00:00Z', kind: 'COUNT', amount: 9000, quantity: 9000, reserved: 3000 },
    { at: '2026-03-09T14:00:00Z', kind: 'RELEASE', amount: 3000, quantity: 9000, reserved: 0 },
    { at: '2026-03-10T04:00:00Z', kind: 'COUNT', amount: 0, quantity: 0, reserved: 0 },
  ];
  for (const [index, sample] of samples.entries()) {
    await db.inventoryMovement.create({
      data: {
        storeId,
        itemId: item.id,
        requestId: 'trend-' + index,
        kind: sample.kind,
        amount: sample.amount,
        quantityBefore: quantity,
        quantityAfter: sample.quantity,
        reservedBefore: reserved,
        reservedAfter: sample.reserved,
        reorderPointBefore: 0,
        reorderPointAfter: 0,
        versionBefore: index,
        actorId: user.userId,
        reason: 'Synthetic dated ledger',
        createdAt: new Date(sample.at),
      },
    });
    quantity = sample.quantity;
    reserved = sample.reserved;
  }
  await db.inventoryItem.update({
    where: { id: item.id },
    data: {
      quantity,
      reservedQuantity: reserved,
      availableQuantity: quantity - reserved,
      version: samples.length,
    },
  });
  const before = await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } }),
    ledgerBefore = await db.inventoryMovement.count(),
    auditsBefore = await db.authAuditLog.count();
  const query = { fromDate: '2026-03-07', toDate: '2026-03-09', timeZone: 'America/New_York' };
  const trend = await service.report(user, storeId, item.id, query);
  assert.deepEqual(
    trend.days.map((day) => day.closing),
    [10, 12, 9],
  );
  assert.deepEqual(
    trend.days.map((day) => day.availableClosing),
    [7, 9, 9],
  );
  assert.deepEqual(
    trend.days.map((day) => (Date.parse(day.endAt) - Date.parse(day.startAt)) / 3600000),
    [24, 23, 24],
  );
  assert.deepEqual(
    [
      trend.summary.opening,
      trend.summary.received,
      trend.summary.issued,
      trend.summary.lost,
      trend.summary.countGain,
      trend.summary.countLoss,
      trend.summary.closing,
      trend.summary.movementCount,
    ],
    [10, 2, 4, 1, 2, 0, 9, 6],
  );
  const report = await reports.report(user, storeId, {
    startAt: trend.startAt,
    endAt: trend.endAt,
    itemId: item.id,
  });
  for (const key of [
    'opening',
    'received',
    'issued',
    'lost',
    'countGain',
    'countLoss',
    'closing',
    'movementCount',
  ] as const)
    assert.equal(trend.summary[key], report.rows[0][key]);
  const partial = await service.report(user, storeId, item.id, {
    startAt: '2026-03-07T10:00:00Z',
    endAt: '2026-03-09T12:00:00Z',
    timeZone: query.timeZone,
  });
  assert.equal(partial.days[0].startAt, '2026-03-07T10:00:00.000Z');
  assert.equal(partial.days[2].endAt, '2026-03-09T12:00:00.000Z');
  assert.equal(partial.summary.closing, 8);
  assert.equal(partial.summary.availableClosing, 5);
  const quiet = await service.report(user, storeId, item.id, { ...query, toDate: '2026-03-11' });
  assert.equal(quiet.days[3].countLoss, 9);
  assert.equal(quiet.days[4].movementCount, 0);
  assert.equal(quiet.days[4].closing, 0);
  assert.equal(quiet.days[4].state, 'RECORDED');
  const fresh = await db.inventoryItem.create({
    data: {
      storeId,
      code: 'FRESH',
      name: 'Created during period',
      unit: 'kg',
      createdAt: new Date('2026-03-08T08:00:00Z'),
    },
  });
  const created = await service.report(user, storeId, fresh.id, query);
  assert.equal(created.days[0].state, 'NOT_CREATED');
  assert.equal(created.days[0].closing, null);
  assert.equal(created.days[1].startAt, '2026-03-08T08:00:00.000Z');
  assert.equal(created.days[1].partial, true);
  assert.equal(created.days[1].closing, 0);
  const futureStart = new Date(Date.now() + 2 * 86400000),
    futureEnd = new Date(futureStart.getTime() + 86400000);
  const future = await service.report(user, storeId, item.id, {
    startAt: futureStart.toISOString(),
    endAt: futureEnd.toISOString(),
    timeZone: 'UTC',
  });
  assert.ok(future.days.every((day) => day.state === 'FUTURE' && day.closing === null));
  assert.equal(future.summary.closing, null);
  const live = await service.report(user, storeId, item.id, {
    startAt: new Date(Date.now() - 3600000).toISOString(),
    endAt: futureStart.toISOString(),
    timeZone: 'UTC',
  });
  const lastRecorded = [...live.days].reverse().find((day) => day.state === 'RECORDED')!;
  assert.equal(lastRecorded.endAt, live.asOfAt);
  assert.equal(lastRecorded.partial, true);
  assert.ok(live.days.some((day) => day.state === 'FUTURE'));
  const wide = await service.report(user, storeId, item.id, {
    fromDate: '2026-01-01',
    toDate: '2026-12-31',
    timeZone: 'UTC',
  });
  assert.equal(wide.days.length, 365);
  assert.equal(wide.summary.closing, 0);
  await assert.rejects(service.report(user, foreign, item.id, query), /inventory.notFound/);
  await assert.rejects(service.report({ ...user, merchantStoreIds: [foreign] }, storeId, item.id, query));
  await assert.rejects(
    service.report(user, storeId, item.id, { ...query, timeZone: 'wrong/zone' }),
    /invalidTimeZone/,
  );
  assert.deepEqual(await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } }), before);
  assert.equal(await db.inventoryMovement.count(), ledgerBefore);
  assert.equal(await db.authAuditLog.count(), auditsBefore);
  const plan = await db.$queryRaw<Record<string, unknown>[]>(
    Prisma.sql`EXPLAIN SELECT SUM(amount) FROM inventory_movements FORCE INDEX (inventory_movements_storeId_itemId_createdAt_idx) WHERE storeId = ${storeId} AND itemId = ${item.id} AND createdAt >= ${new Date(trend.startAt)} AND createdAt < ${new Date(trend.endAt)}`,
  );
  assert.equal(plan[0].key, 'inventory_movements_storeId_itemId_createdAt_idx');
  assert.equal(plan[0].type, 'range');
  console.log(
    'PASS MySQL daily trends: exact indexed ranges and period-report parity, DST 23h, opening/closing/available reservations, exclusive cutoff, counts/loss and quiet-day carry, pre-creation gaps, live cutoff/future gaps, full-year aggregation, readonly snapshot and tenant isolation.',
  );
}
