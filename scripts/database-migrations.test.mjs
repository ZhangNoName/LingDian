import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('order idempotency is store-scoped and keeps the old protection until the replacement index exists', async () => {
  const [schema, migration] = await Promise.all([
    readFile(new URL('../packages/db/prisma/schema.prisma', import.meta.url), 'utf8'),
    readFile(new URL(
      '../packages/db/prisma/migrations/20260829_store_scoped_order_idempotency/migration.sql',
      import.meta.url,
    ), 'utf8'),
  ]);

  assert.match(schema, /@@unique\(\[storeId, customerUserId, clientRequestId\]\)/);
  const createReplacement = migration.indexOf(
    'CREATE UNIQUE INDEX `orders_storeId_customerUserId_clientRequestId_key`',
  );
  const dropPrevious = migration.indexOf(
    'DROP INDEX `orders_customerUserId_clientRequestId_key`',
  );
  assert.ok(createReplacement >= 0, 'replacement idempotency index must be created');
  assert.ok(dropPrevious > createReplacement, 'old unique index must remain until its replacement exists');
});

test('channel pickup codes use nullable legacy fields and an atomic per-source sequence', async () => {
  const [schema, migration] = await Promise.all([
    readFile(new URL('../packages/db/prisma/schema.prisma', import.meta.url), 'utf8'),
    readFile(new URL(
      '../packages/db/prisma/migrations/20260829_channel_pickup_codes/migration.sql',
      import.meta.url,
    ), 'utf8'),
  ]);

  assert.match(schema, /enum OrderSource[\s\S]*MINIAPP[\s\S]*MEITUAN_WAIMAI[\s\S]*JD_DAOJIA[\s\S]*POS[\s\S]*MANUAL/);
  assert.match(schema, /@@unique\(\[storeId, pickupBusinessDate, pickupCode\]\)/);
  assert.match(schema, /@@unique\(\[storeId, businessDate, orderSource\]\)/);
  assert.match(migration, /ADD COLUMN `pickupCode` VARCHAR\(16\) NULL/);
  assert.match(migration, /ADD COLUMN `pickupBusinessDate` DATE NULL/);
  assert.match(migration, /CREATE TABLE `pickup_code_sequences`/);
  assert.doesNotMatch(migration, /UPDATE\s+`?orders`?/i, 'legacy orders must not receive invented pickup credentials');
});
