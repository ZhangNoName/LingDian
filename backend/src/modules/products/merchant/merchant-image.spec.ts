import 'reflect-metadata';
import assert = require('node:assert/strict');
import { test } from 'node:test';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { MerchantImageDto } from './merchant-image.dto';
import { MerchantImageService } from './merchant-image.service';
import { MerchantImageScopeGuard } from './merchant-image-scope.guard';
import { ProductImageStorage, imageBucket, PRODUCT_IMAGE_MAX_BYTES } from './product-image-storage';
const sharp = require('sharp') as typeof import('sharp').default;
test('image DTO accepts exact multipart integer versions and rejects coercion, old versions and foreign URL claims', () => {
  for (const expected_version of [0, '0', '123'])
    assert.equal(
      validateSync(plainToInstance(MerchantImageDto, { requestId: 'retry-image', expected_version })).length,
      0,
    );
  for (const expected_version of [undefined, null, -1, 1.5, true, ['0'], '1.5', '-1', '01', 2147483647])
    assert.ok(validateSync(plainToInstance(MerchantImageDto, { requestId: 'retry-image', expected_version })).length);
  assert.ok(
    validateSync(
      plainToInstance(MerchantImageDto, {
        requestId: 'retry-image',
        expected_version: 0,
        storeId: 'other',
        image_url: '/uploads/foreign.webp',
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    ).length,
  );
});
test('merchant image decoding rejects spoofed types, malformed and oversized files and produces metadata-free bounded WebP', async () => {
  const storage = new ProductImageStorage();
  const source = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#cd8731' } })
    .withMetadata()
    .png()
    .toBuffer();
  const data = await storage.normalize({ buffer: source, mimetype: 'image/png' }),
    metadata = await sharp(data).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 960);
  assert.equal(metadata.height, 640);
  assert.equal(metadata.exif, undefined);
  await assert.rejects(storage.normalize({ buffer: source, mimetype: 'image/jpeg' }), /imageType/);
  await assert.rejects(storage.normalize({ buffer: Buffer.from('<svg/>'), mimetype: 'image/svg+xml' }), /imageType/);
  await assert.rejects(storage.normalize({ buffer: Buffer.from('not a PNG'), mimetype: 'image/png' }), /imageInvalid/);
  await assert.rejects(
    storage.normalize({ buffer: Buffer.alloc(PRODUCT_IMAGE_MAX_BYTES + 1), mimetype: 'image/png' }),
    /imageTooLarge/,
  );
  await assert.rejects(storage.normalize(), /imageRequired/);
});
test('owned image publication is atomic, immutable under retries and cleanup preserves other assets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lingdian-image-files-'));
  try {
    const storage = new ProductImageStorage(root),
      key = randomUUID(),
      other = randomUUID(),
      store = 'store/../a';
    const data = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#cd8731' } })
      .webp()
      .toBuffer();
    await Promise.all([storage.write(store, key, data), storage.write(store, key, data)]);
    await storage.write(store, other, data);
    assert.deepEqual(await readFile(join(root, imageBucket(store), key + '.webp')), data);
    assert.equal(
      (await readdir(join(root, imageBucket(store)))).some((name) => name.endsWith('.tmp')),
      false,
    );
    await assert.rejects(storage.write(store, '../foreign', data), /Invalid owned/);
    await storage.remove(store, key);
    assert.deepEqual(await readdir(join(root, imageBucket(store))), [other + '.webp']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('image service and pre-multipart guard reject store scope before any file or replay lookup', async () => {
  const db = new Proxy(
      {},
      {
        get() {
          throw Error('early database access');
        },
      },
    ) as never,
    scope = {
      assertIncludes: () => {
        throw Error('scope denied');
      },
    } as never;
  const service = new MerchantImageService(db, scope, {} as never, {} as never);
  await assert.rejects(service.upload({} as never, 'foreign', 'p', {} as never), /scope denied/);
  await assert.rejects(service.remove({} as never, 'foreign', 'p', {} as never), /scope denied/);
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ user: {}, params: { storeId: 'foreign', id: 'p' } }) }),
  } as never;
  await assert.rejects(new MerchantImageScopeGuard(db, scope).canActivate(context), /scope denied/);
});
