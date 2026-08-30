import { spawn } from 'node:child_process';
import mariadb from 'mariadb';
import { createMariaDbConnectionConfig } from '@lingdian/db';
import {
  FRESH_BASELINE_MIGRATION,
  planFreshBaseline,
} from './safe-migrate.lib.mjs';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

assertMySqlDatabaseUrl(databaseUrl);
const driverConfig = createMariaDbConnectionConfig(databaseUrl, {
  requireTls: process.env.DATABASE_MODE === 'external' ||
    (process.env.NODE_ENV === 'production' && process.env.DATABASE_MODE !== 'local'),
});

let connection;
try {
  connection = await mariadb.createConnection(driverConfig);
  const state = await inspectDatabase(connection);
  const plan = planFreshBaseline(state);

  if (plan.action === 'fresh') {
    console.log('Migration preflight: empty database detected; the fresh business baseline will be applied.');
  } else if (plan.action === 'resolve') {
    console.log('Migration preflight: complete legacy business schema detected; recording the fresh baseline without executing its DDL.');
    await runPrisma(['migrate', 'resolve', '--applied', FRESH_BASELINE_MIGRATION, '--config', 'prisma.config.ts']);
  } else {
    console.log('Migration preflight: fresh business baseline is already recorded.');
  }
} catch (error) {
  console.error(safeErrorMessage(error, [databaseUrl]));
  process.exitCode = 1;
} finally {
  await connection?.end().catch(() => undefined);
}

if (!process.exitCode) {
  await runPrisma(['migrate', 'deploy', '--config', 'prisma.config.ts']).catch((error) => {
    console.error(safeErrorMessage(error, [databaseUrl]));
    process.exitCode = 1;
  });
}

if (!process.exitCode) {
  console.log('Migration verification: checking the deployed database against schema.prisma.');
  await runPrisma([
    'migrate', 'diff',
    '--config', 'prisma.config.ts',
    '--from-schema', 'prisma/schema.prisma',
    '--to-config-datasource',
    '--exit-code',
  ]).catch((error) => {
    console.error('Migration verification failed: the deployed database schema differs from schema.prisma.');
    console.error(safeErrorMessage(error, [databaseUrl]));
    process.exitCode = 1;
  });
}

async function inspectDatabase(database) {
  const tables = await database.query(`
    SELECT TABLE_NAME AS tableName
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
  `);
  const tableNames = tables.map((row) => row.tableName);
  const applicationTables = tableNames.filter((table) => table !== '_prisma_migrations');

  const columns = await database.query(`
    SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
  `);
  const columnsByTable = {};
  for (const row of columns) {
    (columnsByTable[row.tableName] ??= []).push(row.columnName);
  }

  const primaryKeys = await database.query(`
    SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'PRIMARY'
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);
  const primaryKeyColumnsByTable = {};
  for (const row of primaryKeys) {
    (primaryKeyColumnsByTable[row.tableName] ??= []).push(row.columnName);
  }

  let baselineRecords = [];
  if (tableNames.includes('_prisma_migrations')) {
    baselineRecords = await database.query(`
      SELECT finished_at AS finishedAt, rolled_back_at AS rolledBackAt
      FROM _prisma_migrations
      WHERE migration_name = ?
    `, [FRESH_BASELINE_MIGRATION]);
  }

  return {
    applicationTables,
    columnsByTable,
    primaryKeyColumnsByTable,
    baselineRecords,
  };
}

function assertMySqlDatabaseUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a valid mysql:// URL.');
  }
  if (parsed.protocol !== 'mysql:' || !parsed.pathname.slice(1)) {
    throw new Error('DATABASE_URL must be a mysql:// URL with an explicit database name.');
  }
}

function runPrisma(args) {
  const packageManagerScript = process.env.npm_execpath;
  const command = packageManagerScript ? process.execPath : 'corepack';
  const commandArgs = packageManagerScript
    ? [packageManagerScript, 'exec', 'prisma', ...args]
    : ['pnpm', 'exec', 'prisma', ...args];

  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { cwd: new URL('..', import.meta.url), env: process.env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Prisma migration command failed${signal ? ` with signal ${signal}` : ` with exit code ${code ?? 'unknown'}`}.`));
    });
  });
}

function safeErrorMessage(error, secrets) {
  const message = error instanceof Error ? error.message : 'Database migration preflight failed.';
  return secrets.reduce((sanitized, secret) => sanitized.split(secret).join('[DATABASE_URL]'), message);
}
