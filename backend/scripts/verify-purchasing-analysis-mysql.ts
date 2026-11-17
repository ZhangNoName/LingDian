import assert = require('node:assert/strict');
import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../src/prisma/prisma.service';
import { MultiStoreContextResolver } from '../src/modules/stores/store-context.resolver';
import { MerchantStoreScope } from '../src/modules/merchant/merchant-store-scope';
import { PurchasingService } from '../src/modules/inventory/purchasing/purchasing.service';
import { PurchasingAnalysisService } from '../src/modules/inventory/purchasing/purchasing-analysis.service';
import type { AuthenticatedUser } from '../src/common/auth/authenticated-user.type';
export async function verifyPurchasingAnalysis(db: PrismaService) {
  const storeId = 'analysis-store-a',
    foreign = 'analysis-store-b';
  for (const id of [storeId, foreign]) await db.store.create({ data: { id, code: id, name: id } });
  const scope = new MerchantStoreScope(
      new MultiStoreContextResolver(db, new ConfigService({ store: { primaryStoreId: storeId } })),
    ),
    purchases = new PurchasingService(db, scope),
    analysis = new PurchasingAnalysisService(db, scope),
    user: AuthenticatedUser = {
      userId: 'analysis-merchant',
      sessionId: 'synthetic-session',
      audience: 'merchant-api',
      roles: ['MERCHANT'],
      merchantStoreIds: [storeId],
    };
  await db.supplier.create({ data: { id: 'analysis-supplier', storeId, code: 'S-A', name: 'Original supplier' } });
  await db.supplier.create({
    data: { id: 'analysis-foreign-supplier', storeId: foreign, code: 'S-B', name: 'Foreign supplier' },
  });
  await db.inventoryItem.create({
    data: {
      id: 'analysis-flour',
      storeId,
      code: 'F',
      name: 'Flour',
      unit: 'kg',
      quantity: 1000,
      reservedQuantity: 500,
      availableQuantity: 500,
      reorderPoint: 10000,
    },
  });
  await db.inventoryItem.create({
    data: { id: 'analysis-milk', storeId, code: 'M', name: 'Milk', unit: 'l', reorderPoint: 1000 },
  });
  await db.inventoryItem.create({
    data: {
      id: 'analysis-healthy',
      storeId,
      code: 'H',
      name: 'Healthy',
      unit: 'pc',
      quantity: 2000,
      availableQuantity: 2000,
      reorderPoint: 1000,
    },
  });
  await db.inventoryItem.create({
    data: { id: 'analysis-foreign-item', storeId: foreign, code: 'F', name: 'Foreign flour', unit: 'kg' },
  });
  const create = (key: string, itemId: string, quantity: number, unitPrice = 1) =>
    purchases.create(user, storeId, {
      requestId: 'analysis-' + key,
      supplierId: 'analysis-supplier',
      note: 'Synthetic order',
      lines: [{ itemId, quantity, unitPrice }],
    });
  const flour = await create('flour', 'analysis-flour', 5),
    milk = await create('milk', 'analysis-milk', 1);
  let plan = await analysis.replenishment(user, storeId, {});
  assert.equal(plan.rows.find((row) => row.id === 'analysis-flour')?.recommendedQuantity, 4.5);
  assert.equal(plan.rows.find((row) => row.id === 'analysis-flour')?.availableQuantity, 0.5);
  assert.equal(plan.rows.find((row) => row.id === 'analysis-milk')?.recommendedQuantity, 0);
  assert.equal(plan.summary.coveredCount, 1);
  const first = await purchases.receive(user, storeId, flour.id, {
    requestId: 'analysis-first-receipt',
    expectedVersion: 0,
    note: 'First delivery',
    lines: [{ lineId: flour.lines[0].id, quantity: 2 }],
  });
  await db.purchaseReceipt.update({ where: { id: first.id }, data: { createdAt: new Date('2026-01-01T00:00:00Z') } });
  plan = await analysis.replenishment(user, storeId, { itemId: 'analysis-flour' });
  assert.equal(plan.rows[0].availableQuantity, 2.5);
  assert.equal(plan.rows[0].pendingQuantity, 3);
  assert.equal(plan.rows[0].recommendedQuantity, 4.5);
  await purchases.cancel(user, storeId, flour.id, { expectedVersion: 1, note: 'Cancel remaining' });
  plan = await analysis.replenishment(user, storeId, { keyword: 'Flour' });
  assert.equal(plan.rows[0].pendingQuantity, 0);
  assert.equal(plan.rows[0].recommendedQuantity, 7.5);
  const covered = await create('flour-cover', 'analysis-flour', 8);
  plan = await analysis.replenishment(user, storeId, { itemId: 'analysis-flour' });
  assert.equal(plan.rows[0].pendingOrderCount, 1);
  assert.equal(plan.rows[0].recommendedQuantity, 0);
  const milkReceipt = await purchases.receive(user, storeId, milk.id, {
    requestId: 'analysis-milk-receipt',
    expectedVersion: 0,
    note: 'Milk delivered',
    lines: [{ lineId: milk.lines[0].id, quantity: 1 }],
  });
  await db.purchaseReceipt.update({
    where: { id: milkReceipt.id },
    data: { createdAt: new Date('2026-02-01T00:00:00Z') },
  });
  // Historical supplier snapshots and individually rounded cents survive renaming/cancellation.
  await db.supplier.update({ where: { id: 'analysis-supplier' }, data: { name: 'Renamed supplier' } });
  const tiny = await create('rounding', 'analysis-flour', 0.01, 1);
  for (const [index, time] of ['2026-01-15T00:00:00Z', '2026-01-16T00:00:00Z'].entries()) {
    const receipt = await purchases.receive(user, storeId, tiny.id, {
      requestId: 'analysis-tiny-receipt-' + index,
      expectedVersion: index,
      note: 'Small batch',
      lines: [{ lineId: tiny.lines[0].id, quantity: 0.005 }],
    });
    assert.equal(receipt.totalCostCents, 1);
    await db.purchaseReceipt.update({ where: { id: receipt.id }, data: { createdAt: new Date(time) } });
  }
  const bounds = { startAt: '2026-01-01T00:00:00Z', endAt: '2026-02-01T00:00:00Z' };
  const report = await analysis.report(user, storeId, bounds);
  assert.deepEqual(report.summary, {
    receiptCount: 3,
    orderCount: 2,
    supplierCount: 1,
    materialCount: 1,
    totalCostCents: 202,
  });
  assert.equal(report.rows.length, 3);
  assert.equal(report.materials[0].quantity, 2.01);
  assert.equal(report.suppliers.length, 2);
  assert.equal(report.suppliers[0].supplierName, 'Original supplier');
  assert.equal(report.suppliers[1].supplierName, 'Renamed supplier');
  assert.ok(
    report.rows.some((row) => row.orderId === flour.id),
    'Cancelled orders keep already received rows',
  );
  assert.equal((await analysis.report(user, storeId, { ...bounds, itemId: 'analysis-milk' })).rows.length, 0);
  assert.equal((await analysis.report(user, storeId, { ...bounds, keyword: 'Renamed' })).summary.totalCostCents, 2);
  assert.equal(
    (await analysis.report(user, storeId, { ...bounds, supplierId: 'analysis-foreign-supplier' })).rows.length,
    0,
  );
  assert.equal((await analysis.report(user, storeId, { ...bounds, itemId: 'analysis-foreign-item' })).rows.length, 0);
  assert.equal(
    (await analysis.report(user, storeId, { startAt: bounds.endAt, endAt: '2026-02-02T00:00:00Z' })).summary
      .totalCostCents,
    100,
  );
  await assert.rejects(analysis.report(user, foreign, bounds));
  await assert.rejects(analysis.replenishment(user, foreign, {}));
  assert.deepEqual((await analysis.replenishment(user, storeId, { itemId: 'analysis-foreign-item' })).rows, []);
  await assert.rejects(
    analysis.report(user, storeId, { startAt: bounds.endAt, endAt: bounds.startAt }),
    /invalidPeriod/,
  );
  await purchases.cancel(user, storeId, covered.id, { expectedVersion: 0, note: 'No longer needed' });
  plan = await analysis.replenishment(user, storeId, { itemId: 'analysis-flour' });
  assert.equal(plan.rows[0].recommendedQuantity, 7.49);
  console.log(
    'PASS MySQL purchasing analysis: exact half-open receipt boundaries, cancelled-order receipts, historical supplier snapshots, stored-cent aggregation, supplier/material intersection and tenant filtering, outstanding-purchase deductions, reserved availability and cancellation/receipt effects on replenishment.',
  );
}
