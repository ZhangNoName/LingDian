import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { PurchaseReceiptReportRow } from '@lingdian/contracts';
import { summarizeReceipts, safeInteger } from './purchasing-analysis';
import { PurchasingAnalysisService } from './purchasing-analysis.service';
import { PurchaseReportQueryDto } from './purchasing-analysis.dto';
const row = (overrides: Partial<PurchaseReceiptReportRow> = {}): PurchaseReceiptReportRow => ({
  receiptId: 'r1',
  orderId: 'o1',
  orderNo: 'PO1',
  receivedAt: '2026-01-01T00:00:00Z',
  supplierId: 's1',
  supplierName: 'Original',
  supplierCode: 'S1',
  itemId: 'i1',
  itemName: 'Flour',
  itemCode: 'F',
  unit: 'kg',
  quantity: 0.005,
  unitPriceCents: 100,
  costCents: 1,
  actorId: 'u1',
  note: 'Received',
  ...overrides,
});
test('receipt analysis sums posted cents, counts distinct receipts and keeps historical names and units separate', () => {
  const report = summarizeReceipts([
    row(),
    row({ receiptId: 'r2' }),
    row({
      receiptId: 'r3',
      supplierName: 'Renamed',
      itemId: 'i2',
      itemName: 'Milk',
      itemCode: 'M',
      unit: 'l',
      quantity: 2,
      costCents: 99,
    }),
  ]);
  assert.deepEqual(report.summary, {
    receiptCount: 3,
    orderCount: 1,
    supplierCount: 1,
    materialCount: 2,
    totalCostCents: 101,
  });
  assert.equal(report.suppliers.length, 2);
  assert.equal(report.materials[0].quantity, 0.01);
  assert.equal(report.materials[0].totalCostCents, 2);
  assert.equal(report.materials[1].unit, 'l');
  assert.throws(() => safeInteger(BigInt(Number.MAX_SAFE_INTEGER) + 1n), /reportTooLarge/);
  assert.throws(
    () => summarizeReceipts([row({ costCents: Number.MAX_SAFE_INTEGER }), row({ costCents: 1 })]),
    /reportTooLarge/,
  );
});
test('analysis refuses missing timezone or date/supplier bounds and checks scope before queries', async () => {
  const query = { startAt: '2026-01-01T00:00:00Z', endAt: '2026-02-01T00:00:00Z' };
  assert.equal(validateSync(plainToInstance(PurchaseReportQueryDto, query)).length, 0);
  assert.ok(validateSync(plainToInstance(PurchaseReportQueryDto, { ...query, startAt: '2026-01-01' })).length);
  assert.ok(validateSync(plainToInstance(PurchaseReportQueryDto, { ...query, supplierId: '' })).length);
  const scope = {
    assertIncludes: () => {
      throw Error('scope denied');
    },
  } as never;
  const db = new Proxy(
    {},
    {
      get() {
        throw Error('unexpected database access');
      },
    },
  ) as never;
  const service = new PurchasingAnalysisService(db, scope);
  await assert.rejects(service.report({} as never, 'foreign', query), /scope denied/);
  await assert.rejects(service.replenishment({} as never, 'foreign', {}), /scope denied/);
  const allowed = new PurchasingAnalysisService(db, { assertIncludes: () => {} } as never);
  await assert.rejects(allowed.report({} as never, 'own', { ...query, endAt: query.startAt }), /invalidPeriod/);
});
test('reports fail rather than returning a successful truncated snapshot', async () => {
  const db = {
    $transaction: (work: any) =>
      work({
        purchaseReceiptLine: { findMany: () => Array(10001).fill(null) },
        inventoryItem: { findMany: () => Array(10001).fill(null) },
      }),
  } as never;
  const service = new PurchasingAnalysisService(db, { assertIncludes: () => {} } as never);
  await assert.rejects(
    service.report({} as never, 'store', { startAt: '2026-01-01T00:00:00Z', endAt: '2026-02-01T00:00:00Z' }),
    /reportTooLarge/,
  );
  await assert.rejects(service.replenishment({} as never, 'store', {}), /reportTooLarge/);
});
