import 'reflect-metadata';
import assert = require('node:assert/strict');
import { test } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateMerchantCategoryDto } from './merchant-catalog.dto';
import { MerchantCategoryService } from './merchant-category.service';
test('category editing requires version, bounded name/order and explicit boolean visibility without store claims', () => {
  const input = { expected_version: 0, name: 'Bakery', sort_order: 10, is_visible: true };
  assert.equal(validateSync(plainToInstance(UpdateMerchantCategoryDto, input)).length, 0);
  for (const patch of [
    { expected_version: undefined },
    { expected_version: -1 },
    { name: ' ' },
    { name: 'x'.repeat(121) },
    { sort_order: 1.5 },
    { sort_order: 1000001 },
    { is_visible: 'false' },
  ])
    assert.ok(validateSync(plainToInstance(UpdateMerchantCategoryDto, { ...input, ...patch })).length);
  assert.ok(
    validateSync(plainToInstance(UpdateMerchantCategoryDto, { ...input, storeId: 'foreign' }), {
      whitelist: true,
      forbidNonWhitelisted: true,
    }).length,
  );
});
test('category edits check merchant scope before locking a store or reading any category', async () => {
  const db = new Proxy(
      {},
      {
        get() {
          throw Error('early database access');
        },
      },
    ) as never,
    scope = {
      assertIncludes: () => {
        throw Error('scope denied');
      },
    } as never;
  await assert.rejects(
    new MerchantCategoryService(db, scope).update({} as never, 'foreign', 'category', {} as never),
    /scope denied/,
  );
});
