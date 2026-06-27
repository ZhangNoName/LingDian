import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ProductStatus } from '@prisma/client';
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
