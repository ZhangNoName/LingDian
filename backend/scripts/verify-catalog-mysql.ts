import assert = require('node:assert/strict');
import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../src/prisma/prisma.service';
import { ProductConfigurationService } from '../src/modules/products/product-configuration.service';
import { ProductsService } from '../src/modules/products/products.service';
import { MultiStoreContextResolver } from '../src/modules/stores/store-context.resolver';
import type { SyncProductConfigDto } from '../src/modules/products/dto/sync-product-config.dto';
/** Runs only from the disposable-database verifier; fixtures contain no real business data. */
export async function verifyCatalog(db: PrismaService) {
  const storeId = 'catalog-store-a',
    foreign = 'catalog-store-b';
  for (const id of [storeId, foreign]) await db.store.create({ data: { id, code: id, name: id } });
  await db.category.create({ data: { id: 'catalog-category', storeId, name: 'Bakery' } });
  for (const id of ['catalog-product', 'catalog-sibling'])
    await db.product.create({
      data: { id, storeId, categoryId: 'catalog-category', name: id, price: 10, status: 'ACTIVE' },
    });
  await db.productSKU.create({
    data: { id: 'catalog-sku', productId: 'catalog-product', skuName: 'Regular', price: 10, isDefault: true },
  });
  await db.productSKU.create({
    data: { id: 'catalog-sibling-sku', productId: 'catalog-sibling', skuName: 'Regular', price: 10, isDefault: true },
  });
  await db.inventoryItem.create({
    data: {
      id: 'catalog-flour',
      storeId,
      code: 'FLOUR',
      name: 'Flour',
      unit: 'kg',
      quantity: 3000,
      availableQuantity: 3000,
    },
  });
  await db.inventoryRecipe.create({ data: { skuId: 'catalog-sku', itemId: 'catalog-flour', storeId, quantity: 500 } });
  const scope = new MultiStoreContextResolver(db, new ConfigService({ store: { primaryStoreId: storeId } }));
  const service = new ProductsService(db, scope, new ProductConfigurationService(db));
  const actor = { userId: 'catalog-merchant', sessionId: 'synthetic-session' };
  const body: SyncProductConfigDto = {
    expected_version: 0,
    type: 'SINGLE',
    variants: [
      { id: 'catalog-sku', sku_name: 'Regular', price: 12.34, stock_count: 8, is_active: true, is_default: true },
    ],
    selection_groups: [],
  };
  const races = await Promise.allSettled([
    service.syncProductConfiguration('catalog-product', body, [storeId], actor),
    service.syncProductConfiguration(
      'catalog-product',
      { ...body, variants: [{ ...body.variants[0], price: 15 }] },
      [storeId],
      actor,
    ),
  ]);
  assert.equal(races.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(races.filter((r) => r.status === 'rejected').length, 1);
  assert.match(String((races.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason), /catalog.stale/);
  let product = await service.getProductDetail('catalog-product', [storeId]);
  assert.equal(product.configuration_version, 1);
  assert.equal((await db.inventoryRecipe.findFirstOrThrow({ where: { skuId: 'catalog-sku' } })).quantity, 500);
  assert.equal(
    await db.authAuditLog.count({ where: { event: 'CATALOG_CONFIGURATION_UPDATED', userId: actor.userId } }),
    1,
  );
  await assert.rejects(service.updateSkuPrice('catalog-sku', 20, [storeId], 0, actor), /catalog.stale/);
  await assert.rejects(service.updateSkuPrice('catalog-sku', 20, [foreign], 1, actor));
  await service.updateSkuPrice('catalog-sku', 20, [storeId], 1, actor);
  product = await service.getProductDetail('catalog-product', [storeId]);
  assert.equal(product.configuration_version, 2);
  assert.equal(product.price, 20);
  await assert.rejects(
    service.syncProductConfiguration('catalog-product', { ...body, expected_version: 1 }, [storeId], actor),
    /catalog.stale/,
  );
  const group = await db.selectionGroup.create({
    data: { storeId, name: 'Shared temperature', groupType: 'MODIFIER', selectionMode: 'SINGLE' },
  });
  const option = await db.selectionOption.create({ data: { groupId: group.id, name: 'Hot', optionType: 'VALUE' } });
  const own = await db.productSelectionGroup.create({
    data: { productId: 'catalog-product', groupId: group.id, scope: 'PRODUCT' },
  });
  await db.productSelectionGroup.create({
    data: { productId: 'catalog-sibling', groupId: group.id, scope: 'PRODUCT' },
  });
  await service.syncProductConfiguration(
    'catalog-product',
    {
      ...body,
      expected_version: 2,
      selection_groups: [
        {
          id: own.id,
          scope: 'PRODUCT',
          group: {
            id: group.id,
            name: 'My temperature',
            group_type: 'MODIFIER',
            selection_mode: 'SINGLE',
            max_select: 1,
            options: [{ id: option.id, name: 'Warm', option_type: 'VALUE' }],
          },
        },
      ],
    },
    [storeId],
    actor,
  );
  assert.equal((await db.selectionGroup.findUniqueOrThrow({ where: { id: group.id } })).name, 'Shared temperature');
  assert.equal((await db.selectionOption.findUniqueOrThrow({ where: { id: option.id } })).name, 'Hot');
  const bound = await db.productSelectionGroup.findUniqueOrThrow({ where: { id: own.id }, include: { group: true } });
  assert.notEqual(bound.groupId, group.id);
  assert.equal(bound.group.name, 'My temperature');
  const before = await db.product.findUniqueOrThrow({ where: { id: 'catalog-product' } });
  await assert.rejects(
    service.syncProductConfiguration(
      'catalog-product',
      { ...body, expected_version: 3, variants: [{ ...body.variants[0], id: 'catalog-sibling-sku' }] },
      [storeId],
      actor,
    ),
    /catalog.variantUnavailable/,
  );
  assert.equal(
    (await db.product.findUniqueOrThrow({ where: { id: 'catalog-product' } })).configurationVersion,
    before.configurationVersion,
  );
  // An audit failure must roll back product, variants and the version claim together.
  const failing = new Proxy(db, {
    get(target, key) {
      if (key === '$transaction')
        return (work: any, opts: any) =>
          target.$transaction(
            (tx) =>
              work(
                new Proxy(tx, {
                  get(inner, name) {
                    if (name === 'authAuditLog')
                      return {
                        create: async () => {
                          throw new Error('synthetic audit failure');
                        },
                      };
                    return Reflect.get(inner, name);
                  },
                }),
              ),
            opts,
          );
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const failingService = new ProductsService(failing, scope, new ProductConfigurationService(failing));
  await assert.rejects(
    failingService.syncProductConfiguration('catalog-product', { ...body, expected_version: 3 }, [storeId], actor),
    /synthetic audit failure/,
  );
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: 'catalog-product' } })).configurationVersion, 3);
  const added = await service.syncProductConfiguration(
    'catalog-product',
    {
      ...body,
      expected_version: 3,
      variants: [
        ...body.variants,
        { id: 'draft_added', sku_name: 'Large', price: 25, stock_count: 0, is_default: false, is_active: true },
      ],
      selection_groups: [
        {
          scope: 'VARIANT',
          target_variant_id: 'draft_added',
          group: {
            name: 'Size choice',
            group_type: 'MODIFIER',
            selection_mode: 'SINGLE',
            max_select: 1,
            options: [{ name: 'Standard', option_type: 'VALUE' }],
          },
        },
      ],
    },
    [storeId],
    actor,
  );
  const newSku = added.skus.find((sku) => sku.sku_name === 'Large')!;
  assert.ok(newSku);
  assert.notEqual(newSku.id, 'draft_added');
  assert.equal(
    added.selection_groups.find((binding) => binding.group.name === 'Size choice')?.target_variant_id,
    newSku.id,
  );
  // Removing an original SKU deactivates it; recipe foreign keys remain intact.
  await service.syncProductConfiguration(
    'catalog-product',
    {
      expected_version: 4,
      variants: [{ id: newSku.id, sku_name: 'Large', price: 25, stock_count: 1, is_default: true, is_active: true }],
      selection_groups: [],
    },
    [storeId],
    actor,
  );
  assert.equal((await db.productSKU.findUniqueOrThrow({ where: { id: 'catalog-sku' } })).isActive, false);
  assert.equal(await db.inventoryRecipe.count({ where: { skuId: 'catalog-sku' } }), 1);
  await service.updateProduct('catalog-product', { price: 30 }, [storeId]);
  assert.equal(Number((await db.productSKU.findUniqueOrThrow({ where: { id: newSku.id } })).price), 30);
  product = await service.getProductDetail('catalog-product', [storeId]);
  assert.equal(product.configuration_version, 6);
  assert.equal(product.price, 30);
  await assert.rejects(
    service.syncProductConfiguration('catalog-product', { ...body, expected_version: 5 }, [storeId], actor),
    /catalog.stale/,
  );
  console.log(
    'PASS MySQL catalogue: competing configuration, stale price/config, tenant isolation, stable SKU recipes, shared-group copy, audit rollback, new-variant binding and deactivation.',
  );
}
