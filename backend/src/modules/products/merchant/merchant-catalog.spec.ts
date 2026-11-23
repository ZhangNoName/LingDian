import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateMerchantProductDto, MerchantProductStatusDto, UpdateMerchantProductDto } from './merchant-catalog.dto';
import { assertStatusTransition, assertPublishable } from './catalog-publish-policy';
import { MerchantCatalogService } from './merchant-catalog.service';
test('merchant product drafts validate identity, money, text bounds and reject injected store/status fields', () => {
  const body = {
    requestId: 'create-request-key',
    category_id: 'c1',
    name: 'Coffee',
    description: '',
    sku_name: 'Regular',
    price: 12.35,
    is_featured: false,
  };
  assert.equal(validateSync(plainToInstance(CreateMerchantProductDto, body)).length, 0);
  for (const patch of [
    { name: ' ' },
    { price: 1.001 },
    { price: 100000000 },
    { description: 'x'.repeat(2001) },
    { storeId: 'foreign' },
    { status: 'ACTIVE' },
  ])
    assert.ok(
      validateSync(plainToInstance(CreateMerchantProductDto, { ...body, ...patch }), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }).length,
    );
  assert.ok(validateSync(plainToInstance(UpdateMerchantProductDto, { name: 'Coffee', category_id: 'c1' })).length);
  assert.ok(validateSync(plainToInstance(MerchantProductStatusDto, { status: 'ACTIVE' })).length);
});
test('archived products restore to draft before publication and unavailable statuses fail closed', () => {
  assertStatusTransition('DRAFT', 'ACTIVE');
  assertStatusTransition('ACTIVE', 'SOLD_OUT');
  assertStatusTransition('ARCHIVED', 'DRAFT');
  assert.throws(() => assertStatusTransition('ARCHIVED', 'ACTIVE'), /transitionUnavailable/);
  assert.throws(() => assertStatusTransition('FUTURE' as never, 'ACTIVE'), /transitionUnavailable/);
});
test('publishing rejects hidden categories, missing variants and unavailable required choices', async () => {
  let product: any = {
    id: 'p1',
    storeId: 'store-a',
    category: { storeId: 'store-a', isVisible: false },
    skus: [],
    selectionBindings: [],
  };
  const tx = { product: { findUniqueOrThrow: async () => product } } as never;
  await assert.rejects(assertPublishable(tx, 'p1', 'store-a'), /categoryHidden/);
  product.category.isVisible = true;
  await assert.rejects(assertPublishable(tx, 'p1', 'store-a'), /noActiveVariant/);
  product.skus = [{ selectionBindings: [] }];
  product.selectionBindings = [
    {
      group: {
        minSelect: 1,
        maxSelect: 1,
        isRequired: true,
        selectionMode: 'SINGLE',
        options: [
          {
            optionType: 'VARIANT',
            referencedSku: { isActive: true, product: { id: 'other', storeId: 'store-a', status: 'DRAFT' } },
          },
        ],
      },
    },
  ];
  await assert.rejects(assertPublishable(tx, 'p1', 'store-a'), /choicesUnavailable/);
  product.selectionBindings[0].group.options[0].referencedSku.product = {
    id: 'p1',
    storeId: 'store-a',
    status: 'DRAFT',
  };
  await assertPublishable(tx, 'p1', 'store-a');
});
test('merchant catalogue operations assert scope before database reads or replay lookups', async () => {
  const db = new Proxy(
    {},
    {
      get() {
        throw Error('unexpected database access');
      },
    },
  ) as never;
  const scope = {
    assertIncludes: () => {
      throw Error('scope denied');
    },
  } as never;
  const service = new MerchantCatalogService(db, scope, {} as never);
  for (const run of [
    () => service.categories({} as never, 'foreign', {} as never),
    () => service.createCategory({} as never, 'foreign', {} as never),
    () => service.create({} as never, 'foreign', {} as never),
    () => service.details({} as never, 'foreign', 'p1', {} as never),
    () => service.status({} as never, 'foreign', 'p1', {} as never),
  ])
    await assert.rejects(run, /scope denied/);
});
