import { strict as assert } from 'node:assert';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import {
  FRESH_BASELINE_COLUMNS,
  FRESH_BASELINE_MIGRATION,
  FRESH_BASELINE_TABLES,
  planFreshBaseline,
} from '../packages/db/scripts/safe-migrate.lib.mjs';

const completeLegacyState = (overrides = {}) => ({
  applicationTables: [...FRESH_BASELINE_TABLES, 'users'],
  columnsByTable: structuredClone(FRESH_BASELINE_COLUMNS),
  primaryKeyColumnsByTable: Object.fromEntries(FRESH_BASELINE_TABLES.map((table) => [table, ['id']])),
  baselineRecords: [],
  ...overrides,
});

test('an empty database applies the baseline while a complete legacy database resolves it', () => {
  assert.deepEqual(planFreshBaseline({
    applicationTables: [], columnsByTable: {}, primaryKeyColumnsByTable: {}, baselineRecords: [],
  }), { action: 'fresh' });
  assert.deepEqual(planFreshBaseline(completeLegacyState()), { action: 'resolve' });
  assert.deepEqual(planFreshBaseline(completeLegacyState({
    baselineRecords: [{ finishedAt: new Date(), rolledBackAt: null }],
  })), { action: 'ready' });
});

test('migration preflight rejects partial, unrelated, and structurally incomplete databases', () => {
  assert.throws(
    () => planFreshBaseline(completeLegacyState({ applicationTables: FRESH_BASELINE_TABLES.slice(0, -1) })),
    /partial legacy business schema/i,
  );
  assert.throws(
    () => planFreshBaseline({ applicationTables: ['users'], columnsByTable: {}, primaryKeyColumnsByTable: {}, baselineRecords: [] }),
    /not empty/i,
  );
  const incompleteColumns = structuredClone(FRESH_BASELINE_COLUMNS);
  incompleteColumns.orders = incompleteColumns.orders.filter((column) => column !== 'paymentChannel');
  assert.throws(
    () => planFreshBaseline(completeLegacyState({ columnsByTable: incompleteColumns })),
    /orders.*paymentChannel/i,
  );
  assert.throws(
    () => planFreshBaseline(completeLegacyState({
      primaryKeyColumnsByTable: Object.fromEntries(FRESH_BASELINE_TABLES.map((table) => [table, table === 'stores' ? ['code'] : ['id']])),
    })),
    /stores.*primary key/i,
  );
});

test('baseline DDL is first, explicit, and leaves later schema evolution to existing migrations', async () => {
  const migrationsDirectory = new URL('../packages/db/prisma/migrations/', import.meta.url);
  const [migrationNames, baseline] = await Promise.all([
    readdir(migrationsDirectory),
    readFile(new URL(`${FRESH_BASELINE_MIGRATION}/migration.sql`, migrationsDirectory), 'utf8'),
  ]);
  const ordered = migrationNames.filter((name) => /^\d/.test(name)).sort();
  assert.equal(ordered[0], FRESH_BASELINE_MIGRATION);
  for (const table of FRESH_BASELINE_TABLES) {
    assert.ok(baseline.includes('CREATE TABLE `' + table + '`'), `baseline must create ${table}`);
  }
  assert.doesNotMatch(baseline, /IF NOT EXISTS/i);
  assert.doesNotMatch(baseline, /customerUserId|deliveryAddress|orderSource|payment_intents/);
});

test('production migration wrapper fails closed when the deployed schema drifts', async () => {
  const wrapper = await readFile(
    new URL('../packages/db/scripts/migrate-deploy-safe.mjs', import.meta.url),
    'utf8',
  );

  assert.match(wrapper, /migrate', 'deploy'/);
  assert.match(wrapper, /migrate', 'diff'/);
  assert.match(wrapper, /--to-config-datasource/);
  assert.match(wrapper, /--exit-code/);
  assert.match(wrapper, /Migration verification failed/);
});

test('all MariaDB runtime and migration clients share explicit TLS connection options', async () => {
  const files = await Promise.all([
    '../packages/db/scripts/migrate-deploy-safe.mjs',
    '../packages/db/scripts/verify-fresh-database.mjs',
    '../backend/src/prisma/prisma.service.ts',
    '../backend/scripts/bootstrap-production.mjs',
    '../backend/scripts/seed-auth-bootstrap.mjs',
    '../backend/scripts/seed-demo-data.mjs',
  ].map((path) => readFile(new URL(path, import.meta.url), 'utf8')));

  for (const source of files) {
    assert.match(source, /createMariaDbConnectionConfig/);
    assert.doesNotMatch(source, /new PrismaMariaDb\(databaseUrl\)/);
    assert.doesNotMatch(source, /createConnection\(driver[A-Za-z]*DatabaseUrl\)/);
  }
});
