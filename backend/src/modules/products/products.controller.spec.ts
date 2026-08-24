import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { AdminGuard } from '../../common/auth/admin.guard';
import { MerchantGuard } from '../../common/auth/merchant.guard';
import { ProductsController } from './products.controller';

test('management product reads require admin while merchant reads use merchant scope', async () => {
  for (const endpoint of ['getCategories', 'getProducts', 'getProductDetail'] as const) {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ProductsController.prototype[endpoint]) as unknown[];
    assert.ok(guards.includes(AccessTokenGuard));
    assert.ok(guards.includes(AdminGuard));
  }
  for (const endpoint of ['getMerchantProducts', 'getMerchantProductStats', 'getMerchantProductSkuOptions', 'getMerchantProductDetail', 'syncMerchantProductConfiguration', 'updateMerchantSkuStock', 'updateMerchantSkuPrice'] as const) {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ProductsController.prototype[endpoint]) as unknown[];
    assert.ok(guards.includes(AccessTokenGuard));
    assert.ok(guards.includes(MerchantGuard));
  }

  const calls: unknown[] = [];
  const controller = new ProductsController({
    getProducts: async (query: unknown, storeIds: string[]) => { calls.push([query, storeIds]); return []; },
  } as never);
  const query = { page: 2, pageSize: 20 } as never;
  await controller.getMerchantProducts({ merchantStoreIds: ['store-1'] } as never, query);
  assert.deepEqual(calls, [[query, ['store-1']]]);
});
