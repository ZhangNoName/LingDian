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

test('payment invariants are preflighted before durable unique indexes are added', async () => {
  const [schema, migration] = await Promise.all([
    readFile(new URL('../packages/db/prisma/schema.prisma', import.meta.url), 'utf8'),
    readFile(new URL(
      '../packages/db/prisma/migrations/20260830_session_and_payment_invariants/migration.sql',
      import.meta.url,
    ), 'utf8'),
  ]);

  assert.match(schema, /activeOrderKey\s+String\?\s+@unique/);
  assert.match(schema, /@@unique\(\[provider, accountId, providerTransactionId\]\)/);
  const activePreflight = migration.indexOf('CREATE TEMPORARY TABLE `_migration_active_payment_order_keys`');
  const transactionPreflight = migration.indexOf('CREATE TEMPORARY TABLE `_migration_provider_transaction_keys`');
  const firstDurableAlter = migration.indexOf('DROP INDEX `auth_sessions_userId_audience_device_key`');
  const globalTransactionIndex = migration.indexOf(
    'CREATE UNIQUE INDEX `payment_transactions_provider_accountId_providerTransactionId_key`',
  );
  assert.ok(activePreflight >= 0 && transactionPreflight > activePreflight);
  assert.ok(firstDurableAlter > transactionPreflight,
    'ambiguous legacy payment facts must abort before any durable DDL');
  assert.ok(globalTransactionIndex > firstDurableAlter);
  assert.match(migration,
    /UPDATE `payment_transactions` AS `transaction`[\s\S]*`transaction`\.`provider` = `intent`\.`provider`[\s\S]*`transaction`\.`accountId` = `intent`\.`accountId`/);
});
