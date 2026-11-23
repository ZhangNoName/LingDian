import 'reflect-metadata';
import { test } from 'node:test';
import assert = require('node:assert/strict');
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ChangeInventoryLifecycleDto, InventoryQueryDto } from './dto/inventory.dto';
import { InventoryLifecycleService } from './inventory-lifecycle.service';
test('material lifecycle requires explicit booleans, bounded versions and a reason; list scope is a strict enum', () => {
  const input = { isActive: false, expectedVersion: 0, reason: ' No longer used ' };
  const body = plainToInstance(ChangeInventoryLifecycleDto, input);
  assert.equal(validateSync(body).length, 0); assert.equal(body.reason, 'No longer used');
  for (const patch of [{ isActive: 'false' }, { isActive: [false] }, { expectedVersion: -1 }, { expectedVersion: '0' }, { reason: '' }, { reason: ' ' }, { reason: ['test'] }]) assert.ok(validateSync(plainToInstance(ChangeInventoryLifecycleDto, { ...input, ...patch })).length);
  assert.equal(validateSync(plainToInstance(InventoryQueryDto, { lifecycle: 'ARCHIVED' })).length, 0);
  assert.ok(validateSync(plainToInstance(InventoryQueryDto, { lifecycle: ['ALL'] })).length);
});
test('material lifecycle reads and writes reject scope before any database access', async () => {
  const db = new Proxy({}, { get() { throw new Error('database accessed'); } }) as never;
  const service = new InventoryLifecycleService(db, { assertIncludes() { throw new Error('scope denied'); } } as never);
  await assert.rejects(service.detail({} as never, 'foreign', 'item'), /scope denied/);
  await assert.rejects(service.change({} as never, 'foreign', 'item', {} as never), /scope denied/);
});
