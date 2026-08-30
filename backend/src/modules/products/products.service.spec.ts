import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { ProductStatus, SelectionMode, SelectionOptionType } from '@lingdian/db';
import { ProductsService } from './products.service';
import { ProductConfigurationService } from './product-configuration.service';
import {
  PRODUCT_MANAGEMENT_INCLUDE,
  PRODUCT_MENU_INCLUDE,
} from './product-query-shapes';

const primaryStoreId = 'store-1';

function createStoreContext() {
  const resolveStoreIds = (requestedStoreIds?: readonly string[]) => {
    if (requestedStoreIds === undefined) return [primaryStoreId];
    const normalized = [...new Set(requestedStoreIds.map((storeId) => storeId.trim()).filter(Boolean))];
    if (normalized.length !== 1 || normalized[0] !== primaryStoreId) {
      throw new ForbiddenException('Store access is outside the configured store');
    }
    return [primaryStoreId];
  };

  return {
    mode: 'single' as const,
    primaryStoreId: () => primaryStoreId,
    resolveRequestedStoreId: (requestedStoreId?: string) => {
      if (requestedStoreId === undefined || requestedStoreId.trim() === primaryStoreId) {
        return primaryStoreId;
      }
      throw new ForbiddenException('Store access is outside the configured store');
    },
    resolveStoreIds,
    resolveCurrentStore: async () => ({
      id: primaryStoreId,
      code: 'store-primary',
      name: '主门店',
      status: 'OPEN',
      businessHours: null,
      dineInEnabled: true,
      takeoutEnabled: true,
      pickupEnabled: true,
    }),
    assertReady: async () => undefined,
  };
}

function createProductsService(prisma: any, stores: any = createStoreContext()) {
  return new ProductsService(prisma, stores, new ProductConfigurationService(prisma));
}

const productRecord = {
  id: 'product-1',
  storeId: 'store-1',
  name: '拿铁',
  description: '热饮',
  type: 'SINGLE',
  status: 'DRAFT',
  categoryId: 'category-1',
  category: { id: 'category-1', name: '饮品' },
  imageUrl: '/uploads/products/latte.jpg',
  price: 18,
  stock: 0,
  isFeatured: false,
  skus: [
    {
      id: 'sku-1',
      productId: 'product-1',
      skuName: '默认',
      price: 18,
      stockCount: 0,
      isDefault: true,
      isActive: true,
      selectionBindings: [],
    },
  ],
  selectionBindings: [],
};

test('createProduct creates a product with one default sku', async () => {
  const calls: Array<{ model: string; data: unknown }> = [];
  const prisma = {
    store: {
      findFirst: async () => ({ id: 'store-1' }),
    },
    category: {
      findUnique: async () => ({ id: 'category-1', storeId: 'store-1' }),
    },
    product: {
      create: async ({ data }: { data: unknown }) => {
        calls.push({ model: 'product', data });
        return productRecord;
      },
    },
  };
  const service = createProductsService(prisma as never, createStoreContext() as never);

  const result = await service.createProduct({
    category_id: 'category-1',
    name: '拿铁',
    description: '热饮',
    image_url: '/uploads/products/latte.jpg',
    price: 18,
    stock: 0,
  });

  assert.equal(result.id, 'product-1');
  assert.equal(result.price, 18);
  assert.equal(result.skus[0].sku_name, '默认');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].data, {
    storeId: 'store-1',
    categoryId: 'category-1',
    name: '拿铁',
    description: '热饮',
    imageUrl: '/uploads/products/latte.jpg',
    type: 'SINGLE',
    price: 18,
    stock: 0,
    status: ProductStatus.DRAFT,
    isFeatured: false,
    skus: {
      create: {
        skuName: '默认',
        price: 18,
        stockCount: 0,
        isDefault: true,
        isActive: true,
      },
    },
  });
});

test('selection options may reference another SKU from the same store', async () => {
  const created: any[] = [];
  const tx = {
    selectionOption: {
      findMany: async () => [],
      create: async ({ data }: any) => {
        const option = { id: 'option-1', ...data };
        created.push(option);
        return option;
      },
      updateMany: async () => ({ count: 0 }),
    },
    productSKU: {
      findMany: async ({ where }: any) => {
        assert.deepEqual(where, {
          id: { in: ['external-sku'] },
          product: { storeId: 'store-1' },
        });
        return [{ id: 'external-sku' }];
      },
    },
  };
  const configuration = new ProductConfigurationService({} as never);

  await (configuration as any).syncSelectionOptions(
    tx,
    'store-1',
    'group-1',
    [{ name: '套餐配餐', option_type: SelectionOptionType.VARIANT, referenced_sku_id: 'external-sku' }],
    new Map(),
  );

  assert.equal(created[0].referencedSkuId, 'external-sku');
});

test('selection options reject a referenced SKU outside the store', async () => {
  const configuration = new ProductConfigurationService({} as never);
  const tx = {
    selectionOption: { findMany: async () => [] },
    productSKU: { findMany: async () => [] },
  };

  await assert.rejects(
    () => (configuration as any).syncSelectionOptions(
      tx,
      'store-1',
      'group-1',
      [{ name: '越权配餐', option_type: SelectionOptionType.VARIANT, referenced_sku_id: 'foreign-sku' }],
      new Map(),
    ),
    /不属于当前门店/,
  );
});

test('selection configuration rejects impossible selection rules before writing', () => {
  const configuration = new ProductConfigurationService({} as never);
  const base = {
    variants: [{ sku_name: '默认', price: 18, stock_count: 0 }],
    selection_groups: [{
      scope: 'PRODUCT',
      group: {
        name: '温度', group_type: 'MODIFIER', selection_mode: SelectionMode.SINGLE,
        min_select: 2, max_select: 1, options: [{ name: '热', option_type: SelectionOptionType.VALUE }],
      },
    }],
  };

  assert.throws(
    () => (configuration as any).validateSelectionConfiguration(base),
    /最少选择数不能大于最多选择数/,
  );

  assert.throws(
    () => (configuration as any).validateSelectionConfiguration({
      variants: base.variants,
      selection_groups: [{
        scope: 'PRODUCT',
        group: {
          name: '加料', group_type: 'MODIFIER', selection_mode: SelectionMode.MULTIPLE,
          min_select: 2, max_select: 3,
          options: [
            { name: '珍珠', option_type: SelectionOptionType.VALUE, is_active: true },
            { name: '椰果', option_type: SelectionOptionType.VALUE, is_active: false },
          ],
        },
      }],
    }),
    /没有足够的可选项/,
  );
});

test('management details retain disabled bindings and options while the public menu filters them', () => {
  const managementSkuBindings = (PRODUCT_MANAGEMENT_INCLUDE.skus.include as any).selectionBindings;
  const managementProductBindings = PRODUCT_MANAGEMENT_INCLUDE.selectionBindings as any;
  const menuSkuBindings = (PRODUCT_MENU_INCLUDE.skus.include as any).selectionBindings;
  const menuProductBindings = PRODUCT_MENU_INCLUDE.selectionBindings as any;

  assert.equal(managementSkuBindings.where, undefined);
  assert.equal(managementSkuBindings.include.group.include.options.where, undefined);
  assert.equal(managementProductBindings.where, undefined);
  assert.equal(managementProductBindings.include.group.include.options.where, undefined);
  assert.deepEqual((PRODUCT_MENU_INCLUDE.skus as any).where, { isActive: true });
  assert.deepEqual(menuSkuBindings.where, { isEnabled: true, group: { isActive: true } });
  assert.deepEqual(menuSkuBindings.include.group.include.options.where, { isActive: true });
  assert.deepEqual(menuProductBindings.where, { isEnabled: true, group: { isActive: true } });
});

test('a newly created variant explicitly marked default remains the default', async () => {
  let createdCount = 0;
  let selectedDefaultId: string | undefined;
  const tx = {
    productSKU: {
      findMany: async () => [],
      create: async ({ data }: any) => ({ id: `sku-${++createdCount}`, ...data }),
      updateMany: async () => ({ count: 0 }),
      update: async ({ where }: any) => {
        selectedDefaultId = where.id;
        return { id: where.id };
      },
    },
  };
  const configuration = new ProductConfigurationService({} as never);

  await (configuration as any).syncVariants(tx, 'product-1', {
    variants: [
      { sku_name: '小杯', price: 12, stock_count: 10 },
      { sku_name: '大杯', price: 16, stock_count: 8, is_default: true },
    ],
  });

  assert.equal(selectedDefaultId, 'sku-2');
});

test('product list is paginated and returns lightweight rows without nested option payloads', async () => {
  let findQuery: any;
  let countWhere: any;
  const prisma = {
    product: {
      findMany: async (query: any) => {
        findQuery = query;
        return [{
          id: 'product-1', storeId: 'store-1', categoryId: 'category-1', name: '拿铁', description: '热饮',
          imageUrl: null, type: 'SINGLE', status: 'ACTIVE', price: 18, stock: 10, isFeatured: false,
          category: { name: '饮品' }, _count: { selectionBindings: 1 },
          skus: [{
            id: 'sku-1', productId: 'product-1', skuName: '默认', price: 18, stockCount: 10,
            isDefault: true, isActive: true, _count: { selectionBindings: 2 },
          }],
        }];
      },
      count: async ({ where }: any) => { countWhere = where; return 31; },
    },
  };
  const service = createProductsService(prisma as never, createStoreContext() as never);

  const result = await service.getProducts(
    { page: 2, pageSize: 20, keyword: '拿铁', type: 'SINGLE' } as any,
    ['store-1'],
  );

  assert.equal(findQuery.skip, 20);
  assert.equal(findQuery.take, 20);
  assert.deepEqual(findQuery.where, countWhere);
  assert.deepEqual(findQuery.where.storeId, { in: ['store-1'] });
  assert.equal(findQuery.select.selectionBindings, undefined);
  assert.equal(result.total, 31);
  assert.equal(result.items[0].selection_group_count, 3);
  assert.equal('selection_groups' in result.items[0], false);
});

test('product stats and SKU reference options stay scoped to merchant stores', async () => {
  const countCalls: any[] = [];
  let skuListWhere: any;
  const prisma = {
    product: {
      groupBy: async (query: any) => {
        countCalls.push(['product', query]);
        return [
          { status: 'ACTIVE', type: 'SINGLE', _count: { _all: 3 } },
          { status: 'DRAFT', type: 'PACKAGE', _count: { _all: 2 } },
        ];
      },
    },
    productSKU: {
      count: async (query: any) => { countCalls.push(['sku', query]); return 8; },
      findMany: async ({ where }: any) => {
        skuListWhere = where;
        return [{ id: 'sku-1', skuName: '默认', product: { name: '拿铁' } }];
      },
    },
    productSelectionGroup: {
      count: async (query: any) => { countCalls.push(['binding', query]); return 5; },
    },
  };
  const service = createProductsService(prisma as never, createStoreContext() as never);

  const [stats, options] = await Promise.all([
    service.getProductStats(['store-1']),
    service.getProductSkuOptions(['store-1']),
  ]);

  assert.equal(stats.sku_count, 8);
  assert.equal(stats.selection_group_count, 5);
  assert.equal(stats.total_count, 5);
  assert.equal(stats.active_count, 3);
  assert.equal(stats.package_count, 2);
  assert.deepEqual(skuListWhere, { product: { storeId: { in: ['store-1'] } } });
  assert.deepEqual(options, [{ value: 'sku-1', label: '拿铁 / 默认' }]);
  assert.ok(countCalls.every(([, query]) => JSON.stringify(query).includes('store-1')));
});

test('product stats reuse a short-lived store-scoped cache', async () => {
  let groupQueries = 0;
  const prisma = {
    product: { groupBy: async () => { groupQueries += 1; return []; } },
    productSKU: { count: async () => 0 },
    productSelectionGroup: { count: async () => 0 },
  };
  const service = createProductsService(prisma as never, createStoreContext() as never);

  const first = await service.getProductStats(['store-1']);
  const second = await service.getProductStats(['store-1']);

  assert.equal(groupQueries, 1);
  assert.equal(first, second);
});

test('admin product queries default to the configured primary store', async () => {
  let listWhere: any;
  let countWhere: any;
  const prisma = {
    product: {
      findMany: async ({ where }: any) => {
        listWhere = where;
        return [];
      },
      count: async ({ where }: any) => {
        countWhere = where;
        return 0;
      },
    },
  };
  const service = createProductsService(prisma as never, createStoreContext() as never);

  await service.getProducts();

  assert.deepEqual(listWhere.storeId, { in: [primaryStoreId] });
  assert.deepEqual(countWhere.storeId, { in: [primaryStoreId] });
});

test('product queries reject a store scope outside the configured primary store', async () => {
  let queried = false;
  const prisma = {
    product: {
      findMany: async () => {
        queried = true;
        return [];
      },
      count: async () => {
        queried = true;
        return 0;
      },
    },
  };
  const service = createProductsService(prisma as never, createStoreContext() as never);

  await assert.rejects(
    () => service.getProducts(undefined, ['store-other']),
    /outside the configured store/,
  );
  assert.equal(queried, false);
});
