import assert = require('node:assert/strict');
import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../src/prisma/prisma.service';
import { MultiStoreContextResolver } from '../src/modules/stores/store-context.resolver';
import { MerchantStoreScope } from '../src/modules/merchant/merchant-store-scope';
import { ProductsService } from '../src/modules/products/products.service';
import { ProductConfigurationService } from '../src/modules/products/product-configuration.service';
import { MerchantCatalogService } from '../src/modules/products/merchant/merchant-catalog.service';
import type { AuthenticatedUser } from '../src/common/auth/authenticated-user.type';
export async function verifyMerchantCatalog(db: PrismaService) {
  const storeId = 'lifecycle-store-a',
    foreign = 'lifecycle-store-b';
  for (const id of [storeId, foreign]) await db.store.create({ data: { id, code: id, name: id, status: 'OPEN' } });
  const stores = new MultiStoreContextResolver(db, new ConfigService({ store: { primaryStoreId: storeId } })),
    scope = new MerchantStoreScope(stores),
    products = new ProductsService(db, stores, new ProductConfigurationService(db)),
    catalog = new MerchantCatalogService(db, scope, products),
    user: AuthenticatedUser = {
      userId: 'lifecycle-merchant',
      sessionId: 'synthetic-session',
      audience: 'merchant-api',
      roles: ['MERCHANT'],
      merchantStoreIds: [storeId],
    };
  const cats = await Promise.all([
    catalog.createCategory(user, storeId, { name: 'Bakery' }),
    catalog.createCategory(user, storeId, { name: 'Bakery' }),
  ]);
  assert.equal(cats[0].id, cats[1].id);
  assert.equal(await db.category.count({ where: { storeId, name: 'Bakery' } }), 1);
  const other = await db.category.create({ data: { storeId: foreign, name: 'Foreign' } });
  const hidden = await db.category.create({ data: { storeId, name: 'Hidden', isVisible: false } });
  await assert.rejects(catalog.createCategory(user, storeId, { name: 'Hidden' }), /categoryHidden/);
  const body = {
    requestId: 'lifecycle-creation-key',
    category_id: cats[0].id,
    name: 'Bread',
    description: '长'.repeat(1200),
    is_featured: false,
    price: 12.35,
    sku_name: 'Regular',
  };
  await assert.rejects(catalog.create(user, foreign, body));
  await assert.rejects(catalog.create(user, storeId, { ...body, category_id: other.id }), /categoryUnavailable/);
  const created = await Promise.all([catalog.create(user, storeId, body), catalog.create(user, storeId, body)]);
  assert.equal(created[0].id, created[1].id);
  let product = created[0];
  const id = product.id,
    skuId = product.skus[0].id;
  assert.equal(product.status, 'DRAFT');
  assert.equal(product.configuration_version, 0);
  assert.equal(product.description?.length, 1200);
  assert.equal(product.skus[0].stock_count, 0);
  assert.equal((await products.getCurrentMenu(storeId)).categories.length, 0);
  await assert.rejects(catalog.create(user, storeId, { ...body, name: 'Different' }), /requestConflict/);
  assert.equal((await catalog.categories(user, storeId, { page: 1, pageSize: 50, categoryId: cats[0].id })).total, 1);
  assert.equal((await catalog.categories(user, storeId, { page: 1, pageSize: 50, categoryId: other.id })).total, 0);
  await db.inventoryItem.create({ data: { id: 'lifecycle-flour', storeId, code: 'F', name: 'Flour', unit: 'kg' } });
  await db.inventoryRecipe.create({ data: { storeId, skuId, itemId: 'lifecycle-flour', quantity: 500 } });
  product = await catalog.details(user, storeId, id, {
    expected_version: 0,
    category_id: cats[0].id,
    name: 'Renamed bread',
    description: 'More details',
    is_featured: true,
  });
  assert.equal(product.configuration_version, 1);
  assert.equal(product.skus[0].id, skuId);
  assert.equal(product.price, 12.35);
  await assert.rejects(
    catalog.details(user, storeId, id, {
      expected_version: 0,
      category_id: cats[0].id,
      name: 'Stale',
      description: '',
      is_featured: false,
    }),
    /stale/,
  );
  await assert.rejects(
    catalog.details(user, storeId, id, {
      expected_version: 1,
      category_id: other.id,
      name: 'Foreign',
      description: '',
      is_featured: false,
    }),
    /categoryUnavailable/,
  );
  assert.equal((await products.getProductDetail(id, [storeId])).configuration_version, 1);
  assert.equal((await products.getProductStats([storeId])).active_count, 0);
  product = await catalog.status(user, storeId, id, { expected_version: 1, status: 'ACTIVE' });
  assert.equal(product.configuration_version, 2);
  assert.equal((await products.getProductStats([storeId])).active_count, 1);
  assert.equal((await products.getCurrentMenu(storeId)).categories[0].products[0].name, 'Renamed bread');
  const races = await Promise.allSettled(
    ['DRAFT', 'SOLD_OUT'].map((status) =>
      catalog.status(user, storeId, id, { expected_version: 2, status: status as 'DRAFT' | 'SOLD_OUT' }),
    ),
  );
  assert.equal(races.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal((await products.getCurrentMenu(storeId)).categories.length, 0);
  await catalog.status(user, storeId, id, { expected_version: 3, status: 'ACTIVE' });
  await catalog.status(user, storeId, id, { expected_version: 4, status: 'ARCHIVED' });
  await assert.rejects(
    catalog.status(user, storeId, id, { expected_version: 5, status: 'ACTIVE' }),
    /transitionUnavailable/,
  );
  await catalog.status(user, storeId, id, { expected_version: 5, status: 'DRAFT' });
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
                          throw Error('synthetic audit failure');
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
  const failed = new MerchantCatalogService(failing, scope, products);
  await assert.rejects(
    failed.status(user, storeId, id, { expected_version: 6, status: 'ACTIVE' }),
    /synthetic audit failure/,
  );
  assert.equal((await products.getProductDetail(id, [storeId])).configuration_version, 6);
  assert.equal((await products.getCurrentMenu(storeId)).categories.length, 0);
  assert.equal(await db.inventoryRecipe.count({ where: { skuId } }), 1);
  await assert.rejects(failed.createCategory(user, storeId, { name: 'Rollback category' }), /synthetic audit failure/);
  assert.equal(await db.category.count({ where: { storeId, name: 'Rollback category' } }), 0);
  const draft2 = await catalog.create(user, storeId, { ...body, requestId: 'lifecycle-no-variant' });
  await db.productSKU.updateMany({ where: { productId: draft2.id }, data: { isActive: false } });
  await assert.rejects(
    catalog.status(user, storeId, draft2.id, { expected_version: 0, status: 'ACTIVE' }),
    /noActiveVariant/,
  );
  const draft3 = await catalog.create(user, storeId, {
    ...body,
    requestId: 'lifecycle-hidden-category',
    category_id: hidden.id,
  });
  await assert.rejects(
    catalog.status(user, storeId, draft3.id, { expected_version: 0, status: 'ACTIVE' }),
    /categoryHidden/,
  );
  const group = await db.selectionGroup.create({
    data: {
      storeId,
      name: 'Required component',
      groupType: 'COMPONENT',
      selectionMode: 'SINGLE',
      minSelect: 1,
      maxSelect: 1,
      isRequired: true,
      options: { create: { name: 'Unavailable bread', optionType: 'VARIANT', referencedSkuId: draft2.skus[0].id } },
    },
  });
  await db.productSelectionGroup.create({ data: { productId: id, groupId: group.id, scope: 'PRODUCT' } });
  await assert.rejects(
    catalog.status(user, storeId, id, { expected_version: 6, status: 'ACTIVE' }),
    /choicesUnavailable/,
  );
  await assert.rejects(catalog.status(user, foreign, id, { expected_version: 6, status: 'ACTIVE' }));
  assert.equal(await db.authAuditLog.count({ where: { event: 'CATALOG_PRODUCT_CREATED', userId: user.userId } }), 3);
  // A version can become current while this request waits: validate against the locked state.
  const raceProduct = await catalog.create(user, storeId, { ...body, requestId: 'lifecycle-future-version' });
  let injected = false;
  const racing = new Proxy(db, {
    get(target, key) {
      if (key === '$transaction')
        return (work: any, opts: any) =>
          target.$transaction(
            (tx) =>
              work(
                new Proxy(tx, {
                  get(inner, name) {
                    if (name === 'product')
                      return new Proxy(inner.product, {
                        get(delegate, method) {
                          if (method === 'updateMany')
                            return async (args: any) => {
                              if (!injected) {
                                injected = true;
                                await catalog.status(user, storeId, raceProduct.id, {
                                  expected_version: 0,
                                  status: 'ACTIVE',
                                });
                              }
                              return delegate.updateMany(args);
                            };
                          const value = Reflect.get(delegate, method);
                          return typeof value === 'function' ? value.bind(delegate) : value;
                        },
                      });
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
  await assert.rejects(
    new MerchantCatalogService(racing, scope, products).details(user, storeId, raceProduct.id, {
      expected_version: 1,
      category_id: hidden.id,
      name: 'Must not hide a just-published product',
      description: '',
      is_featured: false,
    }),
    /categoryHidden/,
  );
  const afterRace = await products.getProductDetail(raceProduct.id, [storeId]);
  assert.equal(afterRace.status, 'ACTIVE');
  assert.equal(afterRace.configuration_version, 1);
  assert.equal(afterRace.category_id, cats[0].id);
  console.log(
    'PASS MySQL merchant catalogue: same-name category races, creation idempotency, long text, scoped category/products, draft/publish/menu transitions, stale status/details, archive/restore, audit rollback, recipe/SKU retention, hidden category and unavailable required-choice guards.',
  );
}
