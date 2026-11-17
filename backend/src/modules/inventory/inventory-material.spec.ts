import 'reflect-metadata';
import { test } from 'node:test';
import assert = require('node:assert/strict');
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { InventoryMaterialService } from './inventory-material.service';
import { InventoryMaterialChangesDto, RenameInventoryMaterialDto } from './dto/inventory-material.dto';
test('material naming and change history reject scope before database access', async () => {
  const db = new Proxy({}, { get() { throw Error('database accessed'); } }) as never;
  const service = new InventoryMaterialService(db, { assertIncludes() { throw Error('scope first'); } } as never);
  await assert.rejects(service.rename({} as never, 'foreign', 'item', {} as never), /scope first/);
  await assert.rejects(service.changes({} as never, 'foreign', 'item', {} as never), /scope first/);
});
test('name writes require text, explicit versions and reasons; history has bounded typed pagination', () => {
  const input = { name: ' Whole milk ', expectedVersion: 0, reason: ' Correct spelling ' };
  const body = plainToInstance(RenameInventoryMaterialDto, input);
  assert.equal(validateSync(body).length, 0); assert.equal(body.name, 'Whole milk'); assert.equal(body.reason, 'Correct spelling');
  for (const patch of [{ name: '' }, { name: ' ' }, { name: ['name'] }, { name: 'x'.repeat(121) }, { expectedVersion: '0' }, { expectedVersion: -1 }, { expectedVersion: 1.5 }, { reason: ' ' }, { reason: 'x'.repeat(241) }]) assert.ok(validateSync(plainToInstance(RenameInventoryMaterialDto, { ...input, ...patch })).length);
  assert.deepEqual(Object.assign({}, plainToInstance(InventoryMaterialChangesDto, {})), { kind: 'ALL', page: 1 });
  for (const query of [{ kind: ['NAME'] }, { kind: 'AUTH_LOGIN' }, { page: 0 }, { page: [2] }, { page: 1000001 }]) assert.ok(validateSync(plainToInstance(InventoryMaterialChangesDto, query)).length);
});
