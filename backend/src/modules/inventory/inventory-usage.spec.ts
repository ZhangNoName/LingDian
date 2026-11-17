import 'reflect-metadata';
import assert = require('node:assert/strict');
import { test } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { InventoryUsageService } from './inventory-usage.service';
import { InventoryUsageQueryDto } from './dto/inventory-usage.dto';
import { InventoryRecipeService } from './inventory-recipe.service';
test('material usage rejects scope before any database access, including exact recipe detail', async () => {
  const db = new Proxy({}, { get() { throw new Error('database accessed before scope'); } }) as never, scope = { assertIncludes() { throw new Error('scope denied'); } } as never;
  await assert.rejects(new InventoryUsageService(db, scope).usage({} as never, 'foreign', 'item', {} as never), /scope denied/);
  await assert.rejects(new InventoryRecipeService(db, scope).detail({} as never, 'foreign', 'sku'), /scope denied/);
});
test('usage tabs and page bounds are strict and fixed-size pagination has safe defaults', () => {
  assert.deepEqual(Object.assign({}, plainToInstance(InventoryUsageQueryDto, {})), { view: 'RECIPES', page: 1 });
  assert.equal(validateSync(plainToInstance(InventoryUsageQueryDto, { view: 'PURCHASES', page: '2' })).length, 0);
  for (const query of [{ view: ['RECIPES'] }, { view: 'ALL' }, { page: 0 }, { page: 1000001 }, { page: [2] }]) assert.ok(validateSync(plainToInstance(InventoryUsageQueryDto, query)).length);
});
