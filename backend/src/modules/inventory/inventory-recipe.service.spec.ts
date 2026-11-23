import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InventoryRecipeService } from './inventory-recipe.service';
import { SaveRecipeDto } from './dto/inventory-recipe.dto';
import { MerchantStoreScope } from '../merchant/merchant-store-scope';

const user = { userId: 'merchant', sessionId: 's', audience: 'merchant-api' as const, roles: ['MERCHANT' as const], merchantStoreIds: ['store-a'] };
const scope = new MerchantStoreScope({ resolveStoreIds: (ids: string[]) => ids } as never);

test('recipe editing rejects unauthorized stores and duplicated materials before starting a transaction', async () => {
  let started = false;
  const service = new InventoryRecipeService({ $transaction: async () => { started = true; } } as never, scope);
  await assert.rejects(service.save(user, 'store-b', 'sku', { expectedVersion: 0, entries: [] }), /not authorized/);
  await assert.rejects(service.save(user, 'store-a', 'sku', { expectedVersion: 0, entries: [{ itemId: 'flour', quantity: 1 }, { itemId: 'flour', quantity: 2 }] }), /inventory.duplicateMaterial/);
  assert.equal(started, false);
});

test('recipe DTO validates precision, positive consumption and bounded ingredient count', async () => {
  const valid = { expectedVersion: 0, entries: [{ itemId: 'flour', quantity: 0.125 }] };
  assert.equal((await validate(plainToInstance(SaveRecipeDto, valid))).length, 0);
  for (const entries of [[{ itemId: 'flour', quantity: 0 }], [{ itemId: 'flour', quantity: 0.0001 }], [{ itemId: '', quantity: 1 }], Array.from({ length: 21 }, (_, i) => ({ itemId: String(i), quantity: 1 }))]) assert.ok((await validate(plainToInstance(SaveRecipeDto, { ...valid, entries }))).length > 0);
});

test('recipe versions reject stale replacement before deleting the existing recipe', async () => {
  let removed = false;
  const service = new InventoryRecipeService({ $transaction: async (fn: (tx: unknown) => unknown) => fn({
    productSKU: { findFirst: async () => ({ id: 'sku' }), updateMany: async () => ({ count: 0 }) },
    inventoryRecipe: { deleteMany: async () => { removed = true; } },
  }) } as never, scope);
  await assert.rejects(service.save(user, 'store-a', 'sku', { expectedVersion: 0, entries: [] }), /inventory.stale/);
  assert.equal(removed, false);
});
