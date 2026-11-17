import 'reflect-metadata';
import assert = require('node:assert/strict');
import { test } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PurchaseOrderQueryDto } from './purchasing.dto';
import { purchaseDeliveryWhere } from './purchase-delivery';
test('delivery filters use an exclusive zoned instant, retain active statuses and distinguish NULL dates', () => {
  const expectedBefore = '2026-11-18T00:00:00+08:00';
  assert.deepEqual(purchaseDeliveryWhere({ delivery: 'BEFORE', expectedBefore }), { AND: [{ status: { in: ['OPEN', 'PARTIAL'] } }, { expectedAt: { lt: new Date(expectedBefore) } }] });
  assert.deepEqual(purchaseDeliveryWhere({ delivery: 'UNDATED' }), { AND: [{ status: { in: ['OPEN', 'PARTIAL'] } }, { expectedAt: null }] });
  assert.deepEqual(purchaseDeliveryWhere({}), {});
  for (const query of [{ delivery: 'BEFORE' as const }, { delivery: 'BEFORE' as const, expectedBefore: '2026-11-18' }, { delivery: 'ALL' as const, expectedBefore }, { delivery: 'UNDATED' as const, expectedBefore }]) assert.throws(() => purchaseDeliveryWhere(query), /invalidDelivery/);
  assert.equal(validateSync(plainToInstance(PurchaseOrderQueryDto, { delivery: 'BEFORE', expectedBefore })).length, 0);
  for (const query of [{ delivery: ['BEFORE'] }, { delivery: 'DELETE' }, { expectedBefore: '2026-02-30T00:00:00Z' }, { expectedBefore: ['2026-11-18T00:00:00Z'] }, { expectedBefore: '2026-11-18T00:00:00' }]) assert.ok(validateSync(plainToInstance(PurchaseOrderQueryDto, query)).length);
});
