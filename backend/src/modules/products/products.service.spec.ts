import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ProductStatus, SelectionMode, SelectionOptionType } from '@lingdian/db';
import { ProductsService } from './products.service';

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
  const service = new ProductsService(prisma as never);

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
  const service = new ProductsService({} as never);

  await (service as any).syncSelectionOptions(
    tx,
    'store-1',
    'group-1',
    [{ name: '套餐配餐', option_type: SelectionOptionType.VARIANT, referenced_sku_id: 'external-sku' }],
    new Map(),
  );

  assert.equal(created[0].referencedSkuId, 'external-sku');
});

test('selection options reject a referenced SKU outside the store', async () => {
  const service = new ProductsService({} as never);
  const tx = {
    selectionOption: { findMany: async () => [] },
    productSKU: { findMany: async () => [] },
  };

  await assert.rejects(
    () => (service as any).syncSelectionOptions(
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
  const service = new ProductsService({} as never);
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

  assert.throws(() => (service as any).validateSelectionConfiguration(base), /最少选择数不能大于最多选择数/);
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
  const service = new ProductsService(prisma as never);

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
  const service = new ProductsService(prisma as never);

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
  const service = new ProductsService(prisma as never);

  const first = await service.getProductStats(['store-1']);
  const second = await service.getProductStats(['store-1']);

  assert.equal(groupQueries, 1);
  assert.equal(first, second);
});
