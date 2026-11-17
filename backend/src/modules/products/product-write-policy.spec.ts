import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { claimCatalogVersion, requireCatalogVersion } from './product-write-policy';
import { SyncProductConfigDto } from './dto/sync-product-config.dto';
import { UpdateSkuPriceDto } from './dto/update-sku-price.dto';
import { ProductsController } from './products.controller';
import { MerchantStoreScope } from '../merchant/merchant-store-scope';
test('catalogue version conflicts prevent writes and legacy claims still invalidate open drafts', async () => {
  let version = 2;
  const tx = {
    product: {
      updateMany: async ({ where, data }: any) => {
        assert.equal(where.storeId, 'store-a');
        if (where.configurationVersion !== undefined && where.configurationVersion !== version) return { count: 0 };
        version += data.configurationVersion.increment;
        return { count: 1 };
      },
    },
  };
  await assert.rejects(claimCatalogVersion(tx as never, 'p1', 'store-a', 1), /catalog.stale/);
  assert.equal(version, 2);
  await claimCatalogVersion(tx as never, 'p1', 'store-a', 2);
  await claimCatalogVersion(tx as never, 'p1', 'store-a');
  assert.equal(version, 4);
  assert.throws(() => requireCatalogVersion(undefined), /versionRequired/);
  assert.throws(() => requireCatalogVersion(-1), /versionRequired/);
});
test('merchant write endpoints resolve authorized scope before requiring a version or invoking a writer', () => {
  let calls = 0;
  const scope = new MerchantStoreScope({ resolveStoreIds: (ids: string[]) => ids } as never);
  const controller = new ProductsController(
    {
      syncProductConfiguration: () => {
        calls++;
      },
    } as never,
    scope,
  );
  const user = {
    userId: 'merchant',
    audience: 'merchant-api',
    roles: ['MERCHANT'],
    merchantStoreIds: ['store-a'],
  } as never;
  assert.throws(
    () => controller.syncMerchantProductConfiguration('p1', { variants: [] } as never, user, 'store-b'),
    /not authorized/,
  );
  assert.throws(
    () => controller.syncMerchantProductConfiguration('p1', { variants: [] } as never, user, 'store-a'),
    /versionRequired/,
  );
  assert.equal(calls, 0);
});
test('catalogue DTO rejects unrepresentable prices, empty names and excessive request fanout', () => {
  assert.ok(validateSync(plainToInstance(UpdateSkuPriceDto, { sku_id: 's1', price: 1.001 })).length);
  assert.ok(validateSync(plainToInstance(UpdateSkuPriceDto, { sku_id: 's1', price: 100000000 })).length);
  const body = { expected_version: 0, type: 'SINGLE', variants: [{ sku_name: ' ', price: 1, stock_count: 0 }] };
  assert.ok(validateSync(plainToInstance(SyncProductConfigDto, body)).length);
  body.variants = Array.from({ length: 51 }, () => ({ sku_name: 'Regular', price: 1, stock_count: 0 }));
  assert.ok(validateSync(plainToInstance(SyncProductConfigDto, body)).length);
});
