import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { lineCost, cents, distinct } from './purchasing-policy';
import { CreatePurchaseDto, ReceivePurchaseDto, UpdateSupplierDto } from './purchasing.dto';
import { PurchasingService } from './purchasing.service';
import { SupplierService } from './supplier.service';
test('purchase receipt costs round integer thousandths to cents without unsafe multiplication', () => {
  assert.equal(lineCost(1125, 235), 264n);
  assert.equal(lineCost(5, 100), 1n);
  assert.equal(lineCost(999999000, 99999999), 99999899000001n);
  assert.equal(cents(100n), 100);
  assert.throws(() => cents(BigInt(Number.MAX_SAFE_INTEGER) + 1n), /tooLarge/);
  assert.throws(() => distinct(['a', 'a']), /duplicateLine/);
});
test('purchasing DTOs bound exact quantities, prices, dates, versions and fanout', () => {
  const body = {
    requestId: 'test-request',
    supplierId: 'supplier',
    note: '',
    lines: [{ itemId: 'i', quantity: 0.001, unitPrice: 0 }],
  };
  assert.equal(validateSync(plainToInstance(CreatePurchaseDto, body)).length, 0);
  for (const line of [
    { itemId: 'i', quantity: 0, unitPrice: 1 },
    { itemId: 'i', quantity: 1.0001, unitPrice: 1 },
    { itemId: 'i', quantity: 1, unitPrice: 0.001 },
  ])
    assert.ok(validateSync(plainToInstance(CreatePurchaseDto, { ...body, lines: [line] })).length);
  assert.ok(
    validateSync(
      plainToInstance(CreatePurchaseDto, { ...body, lines: Array.from({ length: 51 }, () => body.lines[0]) }),
    ).length,
  );
  assert.ok(validateSync(plainToInstance(CreatePurchaseDto, { ...body, expectedAt: '2026-11-17' })).length);
  assert.ok(
    validateSync(
      plainToInstance(ReceivePurchaseDto, {
        requestId: 'test-request',
        expectedVersion: 0,
        note: ' ',
        lines: [{ lineId: 'l', quantity: 1 }],
      }),
    ).length,
  );
  assert.ok(validateSync(plainToInstance(UpdateSupplierDto, { code: 'S', name: 'Supplier', isActive: true })).length);
});
test('every purchasing operation checks store scope before touching business data', async () => {
  const scope = {
    assertIncludes: () => {
      throw new Error('scope denied');
    },
  } as never;
  const db = new Proxy(
    {},
    {
      get() {
        throw new Error('database accessed before scope');
      },
    },
  ) as never;
  const service = new PurchasingService(db, scope),
    suppliers = new SupplierService(db, scope),
    user = {} as never;
  for (const run of [
    () => service.list(user, 'foreign', {} as never),
    () => service.detail(user, 'foreign', 'p'),
    () => service.receipts(user, 'foreign', 'p', {} as never),
    () => service.create(user, 'foreign', {} as never),
    () => service.receive(user, 'foreign', 'p', {} as never),
    () => service.cancel(user, 'foreign', 'p', {} as never),
    () => suppliers.list(user, 'foreign', {} as never),
    () => suppliers.save(user, 'foreign', {} as never),
  ])
    await assert.rejects(run, /scope denied/);
});
