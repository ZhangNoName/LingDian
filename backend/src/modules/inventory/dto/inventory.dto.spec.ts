import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdjustInventoryDto, CreateInventoryItemDto, InventoryQueryDto } from './inventory.dto';

const options = { whitelist: true, forbidNonWhitelisted: true };
test('inventory DTO rejects invalid precision, negative values and unsupported operations', async () => {
  const valid = { requestId: 'request-0001', kind: 'ISSUE', amount: 0.125, expectedVersion: 0, reason: '厨房领用' };
  assert.equal((await validate(plainToInstance(AdjustInventoryDto, valid), options)).length, 0);
  for (const change of [{ amount: -1 }, { amount: 0.0001 }, { amount: 1000000 }, { amount: '1' }, { kind: 'DELETE' }, { reason: '  ' }, { expectedVersion: -1 }, { storeId: 'foreign' }]) {
    assert.ok((await validate(plainToInstance(AdjustInventoryDto, { ...valid, ...change }), options)).length > 0);
  }
});

test('inventory queries have bounded pagination and validated status', async () => {
  assert.equal((await validate(plainToInstance(InventoryQueryDto, { page: '2', pageSize: '20', status: 'LOW' }), options)).length, 0);
  for (const change of [{ page: '0' }, { pageSize: '101' }, { status: 'bogus' }]) {
    assert.ok((await validate(plainToInstance(InventoryQueryDto, change), options)).length > 0);
  }
});

test('material codes and fixed units are validated and names are trimmed', async () => {
  const item = plainToInstance(CreateInventoryItemDto, { code: ' FLOUR ', name: ' 面粉 ', unit: ' kg ', reorderPoint: 0 });
  assert.equal((await validate(item, options)).length, 0);
  assert.equal(item.name, '面粉');
  assert.equal(item.unit, 'kg');
  for (const code of ['=SUM(A1)', '', 'x'.repeat(65)]) {
    assert.ok((await validate(plainToInstance(CreateInventoryItemDto, { ...item, code }), options)).length > 0);
  }
});

test('activity DTOs require explicit timezone instants and preserve validated loss filters', async () => {
  const { InventoryHistoryQueryDto, InventoryReportQueryDto } = await import('./inventory.dto');
  const period = { startAt: '2026-11-01T00:00:00+08:00', endAt: '2026-11-08T00:00:00+08:00' };
  assert.equal((await validate(plainToInstance(InventoryHistoryQueryDto, { ...period, kind: 'LOSS' }), options)).length, 0);
  assert.equal((await validate(plainToInstance(InventoryReportQueryDto, period), options)).length, 0);
  for (const input of [{}, { ...period, startAt: '2026-11-01' }, { ...period, startAt: '2026-11-01T00:00:00' }, { ...period, kind: 'LOSS' }]) {
    assert.ok((await validate(plainToInstance(InventoryReportQueryDto, input), options)).length > 0);
  }
});
