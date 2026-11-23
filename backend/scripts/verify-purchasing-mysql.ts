import assert = require('node:assert/strict');
import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../src/prisma/prisma.service';
import { PurchasingService } from '../src/modules/inventory/purchasing/purchasing.service';
import { SupplierService } from '../src/modules/inventory/purchasing/supplier.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { InventoryReportService } from '../src/modules/inventory/inventory-report.service';
import { MultiStoreContextResolver } from '../src/modules/stores/store-context.resolver';
import { MerchantStoreScope } from '../src/modules/merchant/merchant-store-scope';
import { syncInventoryAlert } from '../src/modules/inventory/inventory-alert-state';
import type { AuthenticatedUser } from '../src/common/auth/authenticated-user.type';
export async function verifyPurchasing(db: PrismaService) {
  const storeId = 'purchase-store-a',
    foreign = 'purchase-store-b';
  for (const id of [storeId, foreign]) await db.store.create({ data: { id, code: id, name: id } });
  const scope = new MerchantStoreScope(
      new MultiStoreContextResolver(db, new ConfigService({ store: { primaryStoreId: storeId } })),
    ),
    service = new PurchasingService(db, scope),
    suppliers = new SupplierService(db, scope),
    user: AuthenticatedUser = {
      userId: 'synthetic-buyer',
      sessionId: 'synthetic-session',
      audience: 'merchant-api',
      roles: ['MERCHANT'],
      merchantStoreIds: [storeId],
    };
  const supplier = await suppliers.save(user, storeId, {
    code: 'SUP-1',
    name: 'Synthetic supplier',
    contact: '',
    note: '',
    isActive: true,
  });
  await db.supplier.create({
    data: { id: 'purchase-foreign-supplier', storeId: foreign, code: 'SUP-1', name: 'Foreign supplier' },
  });
  for (const id of ['purchase-flour', 'purchase-oil']) {
    const item = await db.inventoryItem.create({
      data: {
        id,
        storeId,
        code: id,
        name: id,
        unit: 'kg',
        ...(id === 'purchase-flour'
          ? { quantity: 1000, reservedQuantity: 500, availableQuantity: 500, reorderPoint: 1000 }
          : {}),
      },
    });
    await db.$transaction((tx) => syncInventoryAlert(tx, item, user.userId));
  }
  await db.inventoryItem.create({
    data: { id: 'purchase-foreign-item', storeId: foreign, code: 'foreign', name: 'foreign', unit: 'kg' },
  });
  const body = {
    requestId: 'synthetic-purchase-order',
    supplierId: supplier.id,
    note: 'Synthetic delivery',
    lines: [
      { itemId: 'purchase-flour', quantity: 3, unitPrice: 2.35 },
      { itemId: 'purchase-oil', quantity: 2, unitPrice: 0.1 },
    ],
  };
  await assert.rejects(service.create(user, foreign, body));
  await assert.rejects(
    service.create(user, storeId, { ...body, supplierId: 'purchase-foreign-supplier' }),
    /supplierUnavailable/,
  );
  await assert.rejects(
    service.create(user, storeId, { ...body, lines: [{ itemId: 'purchase-foreign-item', quantity: 1, unitPrice: 1 }] }),
    /materialUnavailable/,
  );
  const creates = await Promise.all([
    service.create(user, storeId, body),
    service.create(user, storeId, { ...body, lines: [...body.lines].reverse() }),
  ]);
  assert.equal(creates[0].id, creates[1].id);
  let order = creates[0];
  assert.equal(order.totalCostCents, 725);
  assert.equal(order.status, 'OPEN');
  await assert.rejects(service.create(user, storeId, { ...body, note: 'different' }), /requestConflict/);
  await suppliers.save(
    user,
    storeId,
    { code: 'SUP-1', name: 'Renamed supplier', contact: '', note: '', isActive: false, expectedVersion: 0 },
    supplier.id,
  );
  await assert.rejects(
    suppliers.save(
      user,
      storeId,
      { code: 'SUP-1', name: 'Old edit', contact: '', note: '', isActive: true, expectedVersion: 0 },
      supplier.id,
    ),
    /stale/,
  );
  assert.equal((await service.detail(user, storeId, order.id)).supplierName, 'Synthetic supplier');
  await assert.rejects(
    service.create(user, storeId, { ...body, requestId: 'another-purchase-key' }),
    /supplierUnavailable/,
  );
  const flour = order.lines.find((line) => line.itemId === 'purchase-flour')!,
    oil = order.lines.find((line) => line.itemId === 'purchase-oil')!;
  const receive = {
    requestId: 'synthetic-first-receipt',
    expectedVersion: 0,
    note: 'Accepted first delivery',
    lines: [
      { lineId: flour.id, quantity: 1.125 },
      { lineId: oil.id, quantity: 2 },
    ],
  };
  const failing = new Proxy(db, {
    get(target, key) {
      if (key === '$transaction')
        return (work: any, opts: any) =>
          target.$transaction(
            (tx) =>
              work(
                new Proxy(tx, {
                  get(inner, name) {
                    if (name === 'authAuditLog')
                      return {
                        create: async () => {
                          throw Error('synthetic audit failure');
                        },
                      };
                    return Reflect.get(inner, name);
                  },
                }),
              ),
            opts,
          );
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  await assert.rejects(
    new PurchasingService(failing, scope).receive(user, storeId, order.id, {
      ...receive,
      requestId: 'synthetic-first-rollback',
    }),
    /synthetic audit failure/,
  );
  assert.equal(await db.purchaseReceipt.count({ where: { orderId: order.id } }), 0);
  assert.equal((await service.detail(user, storeId, order.id)).version, 0);
  assert.equal((await db.inventoryItem.findUniqueOrThrow({ where: { id: 'purchase-flour' } })).quantity, 1000);
  assert.equal(await db.inventoryAlert.count({ where: { storeId, status: 'RESOLVED' } }), 0);
  const receipts = await Promise.all([
    service.receive(user, storeId, order.id, receive),
    service.receive(user, storeId, order.id, { ...receive, lines: [...receive.lines].reverse() }),
  ]);
  assert.equal(receipts[0].id, receipts[1].id);
  assert.equal(receipts[0].totalCostCents, 284);
  order = await service.detail(user, storeId, order.id);
  assert.equal(order.status, 'PARTIAL');
  assert.equal(order.version, 1);
  assert.equal(order.receivedCostCents, 284);
  const history = await new InventoryService(db, scope).history(user, storeId, { page: 1, pageSize: 20 });
  assert.equal(history.items.length,2);
  assert.ok(history.items.every((row) => row.purchaseOrderId === order.id));
  let item = await db.inventoryItem.findUniqueOrThrow({ where: { id: 'purchase-flour' } });
  assert.deepEqual([item.quantity, item.reservedQuantity, item.availableQuantity], [2125, 500, 1625]);
  assert.equal(await db.inventoryAlert.count({ where: { storeId, status: 'RESOLVED' } }), 2);
  assert.equal(await db.inventoryMovement.count({ where: { purchaseReceiptId: receipts[0].id } }), 2);
  await assert.rejects(
    service.receive(user, storeId, order.id, { ...receive, lines: [{ lineId: flour.id, quantity: 2 }] }),
    /requestConflict/,
  );
  await assert.rejects(
    service.receive(user, storeId, order.id, {
      ...receive,
      requestId: 'synthetic-over-receipt',
      expectedVersion: 1,
      lines: [{ lineId: flour.id, quantity: 2 }],
    }),
    /overReceive/,
  );
  await assert.rejects(
    service.receive(user, storeId, order.id, { ...receive, requestId: 'synthetic-stale-receipt' }),
    /stale/,
  );
  await assert.rejects(service.detail(user, foreign, order.id));
  await assert.rejects(service.receipts(user, foreign, order.id, { page: 1, pageSize: 10 }));
  await assert.rejects(
    new PurchasingService(failing, scope).receive(user, storeId, order.id, {
      ...receive,
      requestId: 'synthetic-rollback-receipt',
      expectedVersion: 1,
      lines: [{ lineId: flour.id, quantity: 0.5 }],
    }),
    /synthetic audit failure/,
  );
  assert.equal((await service.detail(user, storeId, order.id)).version, 1);
  assert.equal(await db.purchaseReceipt.count({ where: { orderId: order.id } }), 1);
  assert.deepEqual(await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } }), item);
  const races = await Promise.allSettled(
    ['a', 'b'].map((suffix) =>
      service.receive(user, storeId, order.id, {
        requestId: 'synthetic-final-receipt-' + suffix,
        expectedVersion: 1,
        note: 'Accepted final delivery',
        lines: [{ lineId: flour.id, quantity: 1.875 }],
      }),
    ),
  );
  assert.equal(races.filter((result) => result.status === 'fulfilled').length, 1);
  order = await service.detail(user, storeId, order.id);
  assert.equal(order.status, 'RECEIVED');
  assert.equal(order.version, 2);
  assert.equal(order.receivedCostCents, 725);
  await assert.rejects(service.cancel(user, storeId, order.id, { expectedVersion: 2, note: 'too late' }), /stale/);
  const report = await new InventoryReportService(db, scope).report(user, storeId, {
    startAt: new Date(Date.now() - 3600000).toISOString(),
    endAt: new Date(Date.now() + 3600000).toISOString(),
  });
  assert.equal(report.rows.find((row) => row.itemId === 'purchase-flour')?.received, 3);
  await suppliers.save(
    user,
    storeId,
    { code: 'SUP-1', name: 'Active again', contact: '', note: '', isActive: true, expectedVersion: 1 },
    supplier.id,
  );
  const second = await service.create(user, storeId, { ...body, requestId: 'synthetic-cancel-order' });
  await service.receive(user, storeId, second.id, {
    requestId: 'synthetic-partial-for-cancel',
    expectedVersion: 0,
    note: 'Partial accepted',
    lines: [{ lineId: second.lines[0].id, quantity: 1 }],
  });
  const before = await db.inventoryItem.findUniqueOrThrow({ where: { id: second.lines[0].itemId } });
  const cancelled = await service.cancel(user, storeId, second.id, {
    expectedVersion: 1,
    note: 'Supplier cannot deliver remainder',
  });
  assert.equal(cancelled.status, 'CANCELLED');
  assert.equal(
    (await service.cancel(user, storeId, second.id, { expectedVersion: 1, note: 'Supplier cannot deliver remainder' }))
      .version,
    2,
  );
  assert.deepEqual(await db.inventoryItem.findUniqueOrThrow({ where: { id: before.id } }), before);
  await assert.rejects(
    service.receive(user, storeId, second.id, {
      requestId: 'synthetic-cancelled-receipt',
      expectedVersion: 2,
      note: 'Blocked',
      lines: [{ lineId: second.lines[0].id, quantity: 1 }],
    }),
    /stale/,
  );
  assert.equal((await service.list(user, storeId, { page: 1, pageSize: 20, status: 'ACTIVE' })).total, 0);
  assert.equal((await service.receipts(user, storeId, order.id, { page: 1, pageSize: 1 })).total, 2);
  console.log(
    'PASS MySQL purchasing: scoped suppliers/materials, snapshot and disable, create/receipt replays, decimal costs, partial/final receipts, stock/reserved/alert/report updates, concurrent stale protection, audit rollback, cancellation and receipt pagination.',
  );
}
