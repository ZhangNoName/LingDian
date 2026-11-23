import assert = require('node:assert/strict');
import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { AuthenticatedUser } from '../src/common/auth/authenticated-user.type';
import { MultiStoreContextResolver } from '../src/modules/stores/store-context.resolver';
import { MerchantStoreScope } from '../src/modules/merchant/merchant-store-scope';
import { ProductsService } from '../src/modules/products/products.service';
import { ProductConfigurationService } from '../src/modules/products/product-configuration.service';
import { MerchantCatalogService } from '../src/modules/products/merchant/merchant-catalog.service';
import { MerchantCategoryService } from '../src/modules/products/merchant/merchant-category.service';
export async function verifyMerchantCategories(db: PrismaService) {
  const storeId = 'category-store-a',
    foreign = 'category-store-b';
  for (const id of [storeId, foreign]) await db.store.create({ data: { id, code: id, name: id, status: 'OPEN' } });
  const stores = new MultiStoreContextResolver(db, new ConfigService({ store: { primaryStoreId: storeId } })),
    scope = new MerchantStoreScope(stores),
    products = new ProductsService(db, stores, new ProductConfigurationService(db)),
    catalog = new MerchantCatalogService(db, scope, products),
    categories = new MerchantCategoryService(db, scope);
  const user: AuthenticatedUser = {
    userId: 'category-merchant',
    sessionId: 'synthetic-session',
    audience: 'merchant-api',
    roles: ['MERCHANT'],
    merchantStoreIds: [storeId, foreign],
  };
  const a = await catalog.createCategory(user, storeId, { name: 'Alpha' }),
    b = await catalog.createCategory(user, storeId, { name: 'Beta' }),
    other = await catalog.createCategory(user, foreign, { name: 'Alpha' });
  const active = await db.product.create({
    data: {
      storeId,
      categoryId: a.id,
      name: 'Bread',
      price: 2,
      status: 'ACTIVE',
      skus: { create: { skuName: 'Regular', price: 2, isDefault: true } },
    },
    include: { skus: true },
  });
  await db.product.create({ data: { storeId, categoryId: a.id, name: 'Draft cake', price: 3, status: 'DRAFT' } });
  await db.product.create({
    data: {
      storeId,
      categoryId: b.id,
      name: 'Milk',
      price: 3,
      status: 'ACTIVE',
      skus: { create: { skuName: 'Regular', price: 3, isDefault: true } },
    },
  });
  // Legacy single-column category FKs do not enforce matching stores. Read projections must still do so.
  await db.product.create({
    data: {
      storeId: foreign,
      categoryId: a.id,
      name: 'Foreign legacy record',
      price: 99,
      status: 'ACTIVE',
      skus: { create: { skuName: 'Foreign', price: 99, isDefault: true } },
    },
  });
  const material = await db.inventoryItem.create({ data: { storeId, code: 'F', name: 'Flour', unit: 'kg' } });
  await db.inventoryRecipe.create({ data: { storeId, skuId: active.skus[0].id, itemId: material.id, quantity: 500 } });
  let page = await catalog.categories(user, storeId, { page: 1, pageSize: 50 });
  let alpha = page.items.find((row) => row.id === a.id)!,
    beta = page.items.find((row) => row.id === b.id)!;
  assert.equal(alpha.configuration_version, 0);
  assert.equal(alpha.product_count, 2);
  assert.equal(alpha.active_product_count, 1);
  let menu = await products.getCurrentMenu(storeId);
  assert.equal(menu.categories[0].products.length, 1);
  assert.equal(menu.categories[0].products[0].name, 'Bread');
  const payload = (row: typeof alpha) => ({
    expected_version: row.configuration_version,
    name: row.name,
    sort_order: row.sort_order,
    is_visible: row.is_visible,
  });
  const updates = await Promise.allSettled([
    categories.update(user, storeId, a.id, { ...payload(alpha), name: 'Bakery', sort_order: 10 }),
    categories.update(user, storeId, a.id, { ...payload(alpha), name: 'Bakes', sort_order: 15 }),
  ]);
  assert.equal(updates.filter((r) => r.status === 'fulfilled').length, 1);
  alpha = (await catalog.categories(user, storeId, { page: 1, pageSize: 50, categoryId: a.id })).items[0];
  assert.equal(alpha.configuration_version, 1);
  assert.equal((await products.getCurrentMenu(storeId)).categories[0].id, b.id);
  await assert.rejects(
    categories.update(user, storeId, a.id, { ...payload(alpha), expected_version: 0 }),
    /categoryStale/,
  );
  await assert.rejects(
    categories.update(user, storeId, b.id, { ...payload(beta), name: alpha.name.toUpperCase() }),
    /categoryNameExists/,
  );
  assert.equal((await db.category.findUniqueOrThrow({ where: { id: b.id } })).version, 0);
  // Existing legacy duplicates can still be sorted/hidden without being renamed.
  await db.category.create({ data: { storeId, name: alpha.name } });
  alpha = await categories.update(user, storeId, a.id, { ...payload(alpha), is_visible: false });
  assert.equal(alpha.configuration_version, 2);
  menu = await products.getCurrentMenu(storeId);
  assert.ok(!menu.categories.some((row) => row.id === a.id));
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: active.id } })).status, 'ACTIVE');
  assert.equal(await db.inventoryRecipe.count({ where: { skuId: active.skus[0].id } }), 1);
  alpha = await categories.update(user, storeId, a.id, { ...payload(alpha), is_visible: true });
  assert.ok((await products.getCurrentMenu(storeId)).categories.some((row) => row.id === a.id));
  await assert.rejects(
    categories.update(user, storeId, other.id, { ...payload(alpha), expected_version: 0 }),
    /categoryUnavailable/,
  );
  await assert.rejects(
    categories.update({ ...user, merchantStoreIds: [storeId] }, foreign, other.id, {
      ...payload(alpha),
      expected_version: 0,
    }),
  );
  await products.updateCategory(b.id, { sort_order: 99 });
  await assert.rejects(categories.update(user, storeId, b.id, payload(beta)), /categoryStale/);
  beta = (await catalog.categories(user, storeId, { page: 1, pageSize: 50, categoryId: b.id })).items[0];
  assert.equal(beta.configuration_version, 1);
  const race = await Promise.allSettled([
    categories.update(user, storeId, b.id, { ...payload(beta), name: 'Fresh category' }),
    catalog.createCategory(user, storeId, { name: 'Fresh category' }),
  ]);
  assert.equal(race[1].status, 'fulfilled');
  assert.equal(await db.category.count({ where: { storeId, name: 'Fresh category' } }), 1);
  const before = await db.category.findUniqueOrThrow({ where: { id: a.id } }),
    auditCount = await db.authAuditLog.count({ where: { event: 'CATALOG_CATEGORY_UPDATED' } });
  const auditDb = new Proxy(db, {
    get(target, key) {
      if (key === '$transaction')
        return (work: any, options: any) =>
          target.$transaction(
            (tx: any) =>
              work(
                new Proxy(tx, {
                  get(t, k) {
                    if (k === 'authAuditLog')
                      return {
                        create: () => {
                          throw Error('forced category audit failure');
                        },
                      };
                    return Reflect.get(t, k);
                  },
                }),
              ),
            options,
          );
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as PrismaService;
  await assert.rejects(
    new MerchantCategoryService(auditDb, scope).update(user, storeId, a.id, {
      ...payload(alpha),
      name: 'Atomic category',
    }),
    /forced category audit failure/,
  );
  assert.deepEqual(await db.category.findUniqueOrThrow({ where: { id: a.id } }), before);
  assert.equal(await db.authAuditLog.count({ where: { event: 'CATALOG_CATEGORY_UPDATED' } }), auditCount);
  page = await catalog.categories(user, storeId, { page: 2, pageSize: 1 });
  assert.equal(page.items.length, 1);
  assert.ok(page.total >= 3);
  assert.equal((await catalog.categories(user, storeId, { page: 1, pageSize: 50, keyword: 'No match' })).total, 0);
  console.log(
    'PASS MySQL categories: scoped counts/menu relations, concurrent version protection, case-insensitive duplicate names and legacy duplicate maintenance, menu order/hide/restore without changing product/SKU/recipe, legacy writes invalidate drafts, create/rename serialization, audit rollback and store/path isolation.',
  );
}
