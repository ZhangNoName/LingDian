import { verifyPurchaseDelivery } from './verify-purchase-delivery-mysql';
import { verifyProductImages } from './verify-product-images-mysql';
import { verifyMerchantCategories } from './verify-merchant-categories-mysql';
import { verifyStocktakes } from './verify-stocktakes-mysql';
/** Opt-in integration verification. Never reads .env or uses the application's DATABASE_URL. */
import 'reflect-metadata';
import { verifyMerchantCatalog } from './verify-merchant-catalog-mysql';
import { verifySettings } from './verify-settings-mysql';
import { verifyPurchasingAnalysis } from './verify-purchasing-analysis-mysql';
import { verifyPurchasing } from './verify-purchasing-mysql';
import { verifyCatalog } from './verify-catalog-mysql';
import { verifyMerchantOperations } from './verify-merchant-operations-mysql';
import assert = require('node:assert/strict');
import { ConfigService } from '@nestjs/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { createMariaDbConnectionConfig, Prisma, PrismaClient } from '@lingdian/db';
import { InventoryAlertService } from '../src/modules/inventory/inventory-alert.service';
import { syncInventoryAlert } from '../src/modules/inventory/inventory-alert-state';
import { OrderStockService } from '../src/modules/inventory/order-stock.service';
import { InventoryRecipeService } from '../src/modules/inventory/inventory-recipe.service';
import { InventoryReportService } from '../src/modules/inventory/inventory-report.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { MultiStoreContextResolver } from '../src/modules/stores/store-context.resolver';
import { MerchantStoreScope } from '../src/modules/merchant/merchant-store-scope';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { AuthenticatedUser } from '../src/common/auth/authenticated-user.type';

async function main() {
  const raw = process.env.INVENTORY_TEST_DATABASE_URL;
  if (!raw) throw new Error('INVENTORY_TEST_DATABASE_URL must point to an empty, migrated, disposable local MySQL database.');
  const url = new URL(raw);
  if (url.protocol !== 'mysql:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      !/^\/lingdian_inventory_[a-z0-9_]*test$/.test(url.pathname)) {
    throw new Error('Refusing anything except a local lingdian_inventory_*test database.');
  }
  const db = new PrismaClient({ adapter: new PrismaMariaDb(createMariaDbConnectionConfig(raw)) });
  try {
    assert.equal(await db.store.count(), 0, 'Refusing a database containing business stores; use a fresh migrated test database.');
    const prisma = db as PrismaService;
    const stores = new MultiStoreContextResolver(prisma, new ConfigService({ store: { primaryStoreId: 'test-store-a' } }));
    const scope = new MerchantStoreScope(stores);
    const user: AuthenticatedUser = { userId: 'test-merchant', sessionId: 'test-session', audience: 'merchant-api', roles: ['MERCHANT'], merchantStoreIds: ['test-store-a'] };
    const stock = new OrderStockService();
    const recipes = new InventoryRecipeService(prisma, scope);
    const inventory = new InventoryService(prisma, scope);
    const reports = new InventoryReportService(prisma, scope);
    for (const suffix of ['a', 'b']) {
      await db.store.create({ data: { id: `test-store-${suffix}`, code: `TEST-${suffix}`, name: `Synthetic store ${suffix}` } });
      await db.category.create({ data: { id: `test-category-${suffix}`, storeId: `test-store-${suffix}`, name: 'Synthetic category' } });
      await db.product.create({ data: { id: `test-product-${suffix}`, storeId: `test-store-${suffix}`, categoryId: `test-category-${suffix}`, name: 'Synthetic product', status: 'ACTIVE', price: 10 } });
      await db.productSKU.create({ data: { id: `test-sku-${suffix}`, productId: `test-product-${suffix}`, skuName: 'Regular', price: 10 } });
      await db.inventoryItem.create({ data: { id: `test-material-${suffix}`, storeId: `test-store-${suffix}`, code: 'RM-001', name: 'Synthetic flour', unit: 'kg' } });
    }
    const storeId = 'test-store-a', itemId = 'test-material-a', skuId = 'test-sku-a';
    await inventory.adjust(user, storeId, itemId, { requestId: 'test-opening-receipt', kind: 'RECEIVE', amount: 1, expectedVersion: 0, reason: 'Synthetic opening receipt' });
    await recipes.save(user, storeId, skuId, { expectedVersion: 0, entries: [{ itemId, quantity: 1 }] });
    const transaction = <T>(run: (tx: Prisma.TransactionClient) => Promise<T>) => db.$transaction(run, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000, maxWait: 15000 });
    const create = (id: string, sku = skuId) => transaction(async tx => {
      const order = await tx.order.create({ data: { id, storeId, orderNo: id, customerName: 'Synthetic customer', customerMobile: '00000000000', orderType: 'PICKUP', status: 'PENDING_PAYMENT', totalAmount: 10, payableAmount: 10 } });
      const expires = await stock.reserve(tx, order, [{ skuId: sku, quantity: 1 }], user.userId);
      assert.ok(expires && expires > new Date());
      await tx.order.update({ where: { id }, data: { stockExpiresAt: expires } });
      return order;
    });
    const results = await Promise.allSettled([create('test-race-1'), create('test-race-2')]);
    assert.equal(results.filter(x => x.status === 'fulfilled').length, 1, 'Exactly one competing checkout must succeed.');
    assert.equal(results.filter(x => x.status === 'rejected').length, 1);
    const failed = results.find(x => x.status === 'rejected') as PromiseRejectedResult;
    assert.match(String(failed.reason), /inventory.orderInsufficient/);
    const winner = (results.find(x => x.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof create>>>).value;
    assert.equal(await db.order.count(), 1, 'Failed checkout must roll back its order.');
    let item = await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    assert.deepEqual([item.quantity, item.reservedQuantity, item.availableQuantity], [1000, 1000, 0]);
    await assert.rejects(inventory.adjust(user, storeId, itemId, { requestId: 'test-invalid-count', kind: 'COUNT', amount: 0, expectedVersion: item.version, reason: 'Must not consume reserved stock' }), /inventory.reserved/);
    // Change the recipe after checkout: settlement must use its immutable reservation.
    await recipes.save(user, storeId, skuId, { expectedVersion: 1, entries: [{ itemId, quantity: 0.5 }] });
    const confirm = () => transaction(async tx => {
      await tx.order.updateMany({ where: { id: winner.id }, data: { status: 'PAID' } }); // same lock order as payment confirmation
      await stock.commit(tx, winner, 'synthetic-payment');
    });
    await Promise.all([confirm(), confirm()]);
    item = await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    assert.deepEqual([item.quantity, item.reservedQuantity, item.availableQuantity], [0, 0, 0]);
    assert.equal(await db.inventoryMovement.count({ where: { kind: 'ISSUE' } }), 1, 'Concurrent duplicate confirmation must issue once.');
    await inventory.adjust(user, storeId, itemId, { requestId: 'test-second-receipt', kind: 'RECEIVE', amount: 1, expectedVersion: item.version, reason: 'Synthetic refill' });
    const cancellation = await create('test-cancel');
    await transaction(async tx => {
      await tx.order.update({ where: { id: cancellation.id }, data: { status: 'CANCELLED' } });
      await stock.release(tx, cancellation, user.userId);
      await stock.release(tx, cancellation, user.userId);
    });
    item = await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    assert.deepEqual([item.quantity, item.reservedQuantity, item.availableQuantity], [1000, 0, 1000]);
    assert.equal(await db.inventoryMovement.count({ where: { kind: 'RELEASE' } }), 1);
    const rollback = await create('test-rollback');
    const balance = await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    const movementCount = await db.inventoryMovement.count();
    await assert.rejects(transaction(async tx => {
      await tx.order.update({ where: { id: rollback.id }, data: { status: 'PAID' } });
      await stock.commit(tx, rollback, user.userId);
      // Force a real MySQL unique-key failure after stock and ledger writes.
      const existing = await tx.inventoryMovement.findFirstOrThrow();
      await tx.inventoryMovement.create({ data: { ...existing } });
    }));
    assert.deepEqual(await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } }), balance);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: rollback.id } })).status, 'PENDING_PAYMENT');
    assert.equal((await db.inventoryReservation.findFirstOrThrow({ where: { orderId: rollback.id } })).status, 'RESERVED');
    assert.equal(await db.inventoryMovement.count(), movementCount);
    await assert.rejects(create('test-foreign-sku', 'test-sku-b'), /inventory.skuUnavailable/);
    await assert.rejects(recipes.save(user, storeId, skuId, { expectedVersion: 2, entries: [{ itemId: 'test-material-b', quantity: 1 }] }), /inventory.notFound/);
    await assert.rejects(reports.report(user, 'test-store-b', { startAt: '2026-01-01T00:00:00Z', endAt: '2026-01-02T00:00:00Z' }));
    const now = Date.now();
    const report = await reports.report(user, storeId, { startAt: new Date(now - 3600000).toISOString(), endAt: new Date(now + 3600000).toISOString() });
    assert.equal(report.rows.length, 1);
    assert.deepEqual([report.rows[0].received, report.rows[0].issued, report.rows[0].closing], [2, 1, 1]);
    const alerts = new InventoryAlertService(prisma, scope);
    const alertMaterial = await inventory.create(user, storeId, { code: 'ALERT-CASE', name: 'Alert lifecycle', unit: 'kg', reorderPoint: 1 });
    const openingAlert = await db.inventoryAlert.findUniqueOrThrow({ where: { activeItemKey: alertMaterial.id } });
    assert.equal(openingAlert.severity, 'OUT');
    const adjustAlertMaterial = async (kind: 'RECEIVE' | 'ISSUE' | 'COUNT', amount: number, requestId: string) => {
      const current = await db.inventoryItem.findUniqueOrThrow({ where: { id: alertMaterial.id } });
      return inventory.adjust(user, storeId, current.id, { kind, amount, requestId, expectedVersion: current.version, reason: 'Synthetic alert verification' });
    };
    await adjustAlertMaterial('RECEIVE', 2, 'test-alert-receive');
    assert.equal((await db.inventoryAlert.findUniqueOrThrow({ where: { id: openingAlert.id } })).status, 'RESOLVED');
    await adjustAlertMaterial('ISSUE', 1.25, 'test-alert-issue');
    const lowAlert = await db.inventoryAlert.findUniqueOrThrow({ where: { activeItemKey: alertMaterial.id } });
    assert.notEqual(lowAlert.id, openingAlert.id); assert.equal(lowAlert.severity, 'LOW');
    await Promise.all([1, 2].map(() => alerts.acknowledge(user, storeId, lowAlert.id, { expectedVersion: lowAlert.version, note: 'Supplier contacted' })));
    assert.equal(await db.authAuditLog.count({ where: { event: 'INVENTORY_ALERT_ACKNOWLEDGED' } }), 1);
    await adjustAlertMaterial('COUNT', 0, 'test-alert-zero-count');
    const escalated = await db.inventoryAlert.findUniqueOrThrow({ where: { activeItemKey: alertMaterial.id } });
    assert.equal(escalated.id, lowAlert.id); assert.equal(escalated.status, 'OPEN'); assert.equal(escalated.severity, 'OUT'); assert.equal(escalated.note, 'Supplier contacted');
    await assert.rejects(alerts.acknowledge(user, storeId, lowAlert.id, { expectedVersion: lowAlert.version, note: 'Old screen must not hide escalation' }), /inventory.alertStale/);
    const page = await alerts.list(user, storeId, { page: 1, pageSize: 20, status: 'OPEN', keyword: 'ALERT-CASE', severity: 'OUT' });
    assert.equal(page.total, 1); assert.equal(page.items[0].availableAtTrigger, 0.75); assert.equal(page.items[0].availableLatest, 0);
    await adjustAlertMaterial('RECEIVE', 2, 'test-alert-refill');
    const beforeRollback = await db.inventoryAlert.findMany({ where: { itemId: alertMaterial.id }, orderBy: { id: 'asc' } });
    const materialBeforeRollback = await db.inventoryItem.findUniqueOrThrow({ where: { id: alertMaterial.id } });
    await assert.rejects(transaction(async tx => {
      const current = await tx.inventoryItem.update({ where: { id: alertMaterial.id }, data: { quantity: 0, availableQuantity: 0, version: { increment: 1 } } });
      await syncInventoryAlert(tx, current, user.userId);
      // Fail after creating the new shortage episode; both alert and stock must roll back.
      await tx.inventoryAlert.create({ data: { ...openingAlert } });
    }));
    assert.deepEqual(await db.inventoryAlert.findMany({ where: { itemId: alertMaterial.id }, orderBy: { id: 'asc' } }), beforeRollback);
    assert.deepEqual(await db.inventoryItem.findUniqueOrThrow({ where: { id: alertMaterial.id } }), materialBeforeRollback);
    const foreignMaterial = await inventory.create({ ...user, merchantStoreIds: ['test-store-b'] }, 'test-store-b', { code: 'FOREIGN-ALERT', name: 'Foreign alert', unit: 'kg', reorderPoint: 0 });
    const foreignAlert = await db.inventoryAlert.findUniqueOrThrow({ where: { activeItemKey: foreignMaterial.id } });
    await assert.rejects(alerts.acknowledge(user, storeId, foreignAlert.id, { expectedVersion: foreignAlert.version, note: 'Cross-store attempt' }), /inventory.alertNotFound/);
    await assert.rejects(alerts.list(user, 'test-store-b', { page: 1, pageSize: 20, status: 'ALL' }));
    assert.equal((await alerts.list(user, storeId, { page: 1, pageSize: 20, status: 'ACTIVE' })).summary.open, 0);
    console.log('PASS MySQL alerts: creation, recovery, new episode, concurrent acknowledgement once, escalation, stale screen, scoped filtering and atomic stock/alert rollback.');
    console.log('PASS MySQL: competing checkout, rollback, immutable recipe snapshot, duplicate confirmation, release, tenant isolation, reserved count protection, report SQL.');
    await verifyMerchantOperations(prisma);
    await verifyCatalog(prisma);
    await verifyPurchasing(prisma);
    await verifyPurchaseDelivery(prisma);
    await verifyPurchasingAnalysis(prisma);
    await verifySettings(prisma);
    await verifyMerchantCatalog(prisma);
    await verifyStocktakes(prisma);
    await verifyMerchantCategories(prisma);
    await verifyProductImages(prisma);
    console.log('Synthetic fixtures retained in the disposable test database for inspection.');
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
