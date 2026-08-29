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
