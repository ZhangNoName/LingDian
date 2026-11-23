import assert = require('node:assert/strict');
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PrismaService } from '../src/prisma/prisma.service';
import type { AuthenticatedUser } from '../src/common/auth/authenticated-user.type';
import { AccessTokenGuard } from '../src/common/auth/access-token.guard';
import { MultiStoreContextResolver } from '../src/modules/stores/store-context.resolver';
import { MerchantStoreScope } from '../src/modules/merchant/merchant-store-scope';
import { ProductsService } from '../src/modules/products/products.service';
import { ProductConfigurationService } from '../src/modules/products/product-configuration.service';
import { MerchantImageService } from '../src/modules/products/merchant/merchant-image.service';
import { MerchantImageController } from '../src/modules/products/merchant/merchant-image.controller';
import { MerchantImageScopeGuard } from '../src/modules/products/merchant/merchant-image-scope.guard';
import {
  ProductImageStorage,
  imageBucket,
  PRODUCT_IMAGE_MAX_BYTES,
} from '../src/modules/products/merchant/product-image-storage';
import { ProductImageCleanupService } from '../src/modules/products/merchant/product-image-cleanup.service';
const sharp = require('sharp') as typeof import('sharp').default;
export async function verifyProductImages(db: PrismaService) {
  const storeId = 'image-store-a',
    foreign = 'image-store-b',
    root = await mkdtemp(join(tmpdir(), 'lingdian-merchant-images-'));
  let app: NestExpressApplication | undefined;
  try {
    for (const id of [storeId, foreign]) {
      await db.store.create({ data: { id, code: id, name: id, status: 'OPEN' } });
      await db.category.create({ data: { id: id + '-category', storeId: id, name: 'Images' } });
    }
    const p = await db.product.create({
      data: {
        storeId,
        categoryId: storeId + '-category',
        name: 'Bread',
        price: 2,
        status: 'ACTIVE',
        skus: { create: { skuName: 'Regular', price: 2, isDefault: true } },
      },
      include: { skus: true },
    });
    const material = await db.inventoryItem.create({ data: { storeId, code: 'F', name: 'Flour', unit: 'kg' } });
    await db.inventoryRecipe.create({ data: { storeId, skuId: p.skus[0].id, itemId: material.id, quantity: 500 } });
    const stores = new MultiStoreContextResolver(db, new ConfigService({ store: { primaryStoreId: storeId } })),
      scope = new MerchantStoreScope(stores),
      products = new ProductsService(db, stores, new ProductConfigurationService(db)),
      storage = new ProductImageStorage(join(root, 'products', 'merchant')),
      images = new MerchantImageService(db, scope, products, storage),
      cleanup = new ProductImageCleanupService(db, storage);
    const user: AuthenticatedUser = {
      userId: 'image-merchant',
      sessionId: 'synthetic-session',
      audience: 'merchant-api',
      roles: ['MERCHANT'],
      merchantStoreIds: [storeId, foreign],
    };
    const png = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#cd8731' } })
        .withMetadata()
        .png()
        .toBuffer(),
      file = { buffer: png, mimetype: 'image/png' };
    const body = { requestId: 'image-concurrent-retry', expected_version: 0 };
    const results = await Promise.all([
      images.upload(user, storeId, p.id, body, file),
      images.upload(user, storeId, p.id, body, file),
    ]);
    assert.equal(results[0].image_url, results[1].image_url);
    assert.equal(results[0].configuration_version, 1);
    const applied = await db.productImageRequest.findUniqueOrThrow({
      where: { storeId_requestId: { storeId, requestId: body.requestId } },
    });
    assert.equal(applied.state, 'APPLIED');
    assert.ok(applied.assetKey);
    const pathFor = (key: string) => join(root, 'products', 'merchant', imageBucket(storeId), key + '.webp');
    const meta = await sharp(await readFile(pathFor(applied.assetKey!))).metadata();
    assert.equal(meta.format, 'webp');
    assert.equal(meta.width, 960);
    assert.equal(meta.exif, undefined);
    assert.equal(await db.authAuditLog.count({ where: { event: 'CATALOG_PRODUCT_IMAGE_UPDATED' } }), 1);
    await products.updateSkuPrice(p.skus[0].id, 3, [storeId], 1, user);
    assert.equal((await images.upload(user, storeId, p.id, body, file)).configuration_version, 2);
    assert.equal(await db.productImageRequest.count({ where: { storeId } }), 1);
    await assert.rejects(
      images.upload(user, storeId, p.id, body, { buffer: Buffer.from('different'), mimetype: 'image/png' }),
      /imageRequestConflict/,
    );
    await assert.rejects(images.upload(user, foreign, p.id, body, file), /productUnavailable/);
    await assert.rejects(
      images.upload(user, storeId, p.id, { requestId: 'image-stale-at-start', expected_version: 0 }, file),
      /catalog.stale/,
    );
    assert.equal(await db.productImageRequest.count({ where: { storeId } }), 1);
    const removed = await images.remove(user, storeId, p.id, { requestId: 'image-remove-retry', expected_version: 2 });
    assert.equal(removed.image_url, null);
    assert.equal(removed.configuration_version, 3);
    await readFile(pathFor(applied.assetKey!));
    assert.equal(
      (await images.remove(user, storeId, p.id, { requestId: 'image-remove-retry', expected_version: 2 }))
        .configuration_version,
      3,
    );
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
                            throw Error('forced image audit failure');
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
    const failedImages = new MerchantImageService(auditDb, scope, products, storage),
      retryBody = { requestId: 'image-audit-recover', expected_version: 3 };
    await assert.rejects(failedImages.upload(user, storeId, p.id, retryBody, file), /forced image audit failure/);
    let current = await products.getProductDetail(p.id, [storeId]);
    assert.equal(current.image_url, null);
    assert.equal(current.configuration_version, 3);
    const pending = await db.productImageRequest.findUniqueOrThrow({
      where: { storeId_requestId: { storeId, requestId: retryBody.requestId } },
    });
    assert.equal(pending.state, 'PENDING');
    await readFile(pathFor(pending.assetKey!));
    current = await images.upload(user, storeId, p.id, retryBody, file);
    assert.equal(current.configuration_version, 4);
    assert.equal(current.image_url, pending.imageUrl);
    const races = await Promise.allSettled(
      ['image-race-a', 'image-race-b'].map((requestId) =>
        images.upload(user, storeId, p.id, { requestId, expected_version: 4 }, file),
      ),
    );
    assert.equal(races.filter((r) => r.status === 'fulfilled').length, 1);
    current = await products.getProductDetail(p.id, [storeId]);
    assert.equal(current.configuration_version, 5);
    for (const row of await db.productImageRequest.findMany({ where: { storeId, state: 'FAILED' } }))
      if (row.assetKey) await assert.rejects(readFile(pathFor(row.assetKey)), /ENOENT/);
    const failedStorage = new Proxy(storage, {
      get(target, key) {
        if (key === 'write')
          return async () => {
            throw Error('forced disk failure');
          };
        const value = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    await assert.rejects(
      new MerchantImageService(db, scope, products, failedStorage).upload(
        user,
        storeId,
        p.id,
        { requestId: 'image-disk-failure', expected_version: 5 },
        file,
      ),
      /imageStorageFailed/,
    );
    assert.equal((await products.getProductDetail(p.id, [storeId])).configuration_version, 5);
    const expiredBody = { requestId: 'image-expired-pending', expected_version: 5 };
    await assert.rejects(failedImages.upload(user, storeId, p.id, expiredBody, file), /forced image audit failure/);
    const expired = await db.productImageRequest.update({
      where: { storeId_requestId: { storeId, requestId: expiredBody.requestId } },
      data: { createdAt: new Date(Date.now() - 172800000) },
    });
    assert.ok(await cleanup.cleanupExpired());
    await assert.rejects(readFile(pathFor(expired.assetKey!)), /ENOENT/);
    assert.equal((await db.productImageRequest.findUniqueOrThrow({ where: { id: expired.id } })).state, 'CLEANED');
    await assert.rejects(images.upload(user, storeId, p.id, expiredBody, file), /imageRequestClosed/);
    await readFile(pathFor(applied.assetKey!));
    assert.equal(await db.inventoryRecipe.count({ where: { skuId: p.skus[0].id } }), 1);
    assert.equal((await db.productSKU.findUniqueOrThrow({ where: { id: p.skus[0].id } })).price.toNumber(), 3);
    assert.equal((await db.product.findUniqueOrThrow({ where: { id: p.id } })).status, 'ACTIVE');
    await assert.rejects(
      db.productImageRequest.create({
        data: {
          storeId: foreign,
          productId: p.id,
          requestId: 'image-foreign-fk',
          fingerprint: 'f'.repeat(64),
          operation: 'REMOVE',
          expectedVersion: 5,
          createdBy: user.userId,
        },
      }),
    );
    // Exercise the actual multipart controller, scope guard, global whitelist and static file serving.
    const module = await Test.createTestingModule({
      controllers: [MerchantImageController],
      providers: [
        { provide: MerchantImageService, useValue: images },
        {
          provide: (require('../src/prisma/prisma.service') as typeof import('../src/prisma/prisma.service'))
            .PrismaService,
          useValue: db,
        },
        { provide: MerchantStoreScope, useValue: scope },
        MerchantImageScopeGuard,
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({
        canActivate(context: any) {
          context.switchToHttp().getRequest().user = user;
          return true;
        },
      })
      .compile();
    app = module.createNestApplication<NestExpressApplication>({ logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    app.useStaticAssets(root, { prefix: '/uploads/' });
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl(),
      endpoint = base + `/api/merchant/stores/${storeId}/products/${p.id}/image`;
    const form = (requestId: string, version: unknown, buffer = png, mimetype = 'image/png') => {
      const body = new FormData();
      body.append('requestId', requestId);
      body.append('expected_version', String(version));
      body.append('file', new Blob([new Uint8Array(buffer)], { type: mimetype }), 'ignored-name.png');
      return body;
    };
    let response = await fetch(endpoint, { method: 'POST', body: form('image-http-upload', 5) });
    assert.equal(response.status, 201);
    const httpRecord = (await response.json()) as { image_url: string; configuration_version: number };
    assert.equal(httpRecord.configuration_version, 6);
    response = await fetch(base + httpRecord.image_url);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /image\/webp/);
    assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).format, 'webp');
    response = await fetch(endpoint, { method: 'POST', body: form('image-http-upload', 5) });
    assert.equal(response.status, 201);
    assert.equal(((await response.json()) as any).configuration_version, 6);
    const beforeRejected = await db.productImageRequest.count({ where: { storeId } });
    response = await fetch(endpoint, { method: 'POST', body: form('image-http-bad-version', 'true') });
    assert.equal(response.status, 400);
    response = await fetch(endpoint, { method: 'POST', body: form('image-http-spoof', 6, png, 'image/jpeg') });
    assert.equal(response.status, 400);
    response = await fetch(endpoint, {
      method: 'POST',
      body: form('image-http-oversized', 6, Buffer.alloc(PRODUCT_IMAGE_MAX_BYTES + 1)),
    });
    assert.equal(response.status, 413);
    response = await fetch(endpoint.replace(storeId, 'not-authorized'), {
      method: 'POST',
      body: form('image-http-outside', 6, Buffer.alloc(PRODUCT_IMAGE_MAX_BYTES + 1)),
    });
    assert.equal(response.status, 403, 'Scope guard must run before multipart size parsing');
    response = await fetch(endpoint.replace(storeId, foreign), {
      method: 'POST',
      body: form('image-http-wrong-path', 6),
    });
    assert.equal(response.status, 404);
    assert.equal(await db.productImageRequest.count({ where: { storeId } }), beforeRejected);
    response = await fetch(endpoint + '/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: 'image-http-remove', expected_version: 6, image_url: '/uploads/foreign.webp' }),
    });
    assert.equal(response.status, 400);
    response = await fetch(endpoint + '/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: 'image-http-remove', expected_version: 6 }),
    });
    assert.equal(response.status, 201);
    assert.equal(((await response.json()) as any).image_url, null);
    console.log(
      'PASS MySQL + HTTP product images: concurrent/replayed uploads once, current-version replay, ownership/path/FK isolation, atomic WebP/static delivery, audit rollback and retry, storage failure, stale cleanup, expired attempt cleanup retaining applied assets, unchanged SKU/recipe/status, real multipart bounds/spoof/whitelist and guards before parsing.',
    );
  } finally {
    if (app) await app.close();
    await rm(root, { recursive: true, force: true });
  }
}
