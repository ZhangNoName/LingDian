import { spawn } from 'node:child_process';
import mariadb from 'mariadb';
import { createMariaDbConnectionConfig } from '@lingdian/db';
import { FRESH_BASELINE_TABLES } from './safe-migrate.lib.mjs';

const freshDatabaseUrl = process.env.FRESH_DATABASE_URL;
if (!freshDatabaseUrl) throw new Error('FRESH_DATABASE_URL is required for the disposable fresh-database verification.');
if (process.env.DATABASE_URL && databaseTarget(process.env.DATABASE_URL) === databaseTarget(freshDatabaseUrl)) {
  throw new Error('FRESH_DATABASE_URL must not equal DATABASE_URL.');
}

assertSafeDatabaseUrl(freshDatabaseUrl);
const driverFreshDatabaseConfig = createMariaDbConnectionConfig(freshDatabaseUrl, {
  requireTls: process.env.DATABASE_MODE === 'external' ||
    (process.env.NODE_ENV === 'production' && process.env.DATABASE_MODE !== 'local'),
});
let failureReported = false;
process.on('uncaughtException', reportFailure);
process.on('unhandledRejection', reportFailure);

const verificationEnv = { ...process.env, DATABASE_URL: freshDatabaseUrl };
let connection = await mariadb.createConnection(driverFreshDatabaseConfig);
try {
  const tables = await readTableNames(connection);
  if (tables.length > 0) {
    throw new Error('Fresh-database verification requires an empty database and never resets an existing schema.');
  }
} finally {
  await connection.end();
}

console.log('Fresh-database verification: applying the complete migration history to an empty database.');
await runPackageScript('migrate:deploy', verificationEnv);

connection = await mariadb.createConnection(driverFreshDatabaseConfig);
try {
  const tables = new Set(await readTableNames(connection));
  const missing = FRESH_BASELINE_TABLES.filter((table) => !tables.has(table));
  if (missing.length > 0) throw new Error(`Fresh migration verification is missing business tables: ${missing.join(', ')}.`);

  const failed = await connection.query(`
    SELECT COUNT(*) AS count
    FROM _prisma_migrations
    WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL
  `);
  if (Number(failed[0]?.count ?? 0) !== 0) {
    throw new Error('Fresh migration verification found an unfinished or rolled-back migration.');
  }
} finally {
  await connection.end();
}

console.log('Fresh-database verification: checking the migrated database against schema.prisma.');
await runPrismaDiff(verificationEnv);
console.log('Fresh-database verification passed.');

async function readTableNames(database) {
  const rows = await database.query(`
    SELECT TABLE_NAME AS tableName
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
  `);
  return rows.map((row) => row.tableName);
}

function runPackageScript(script, env) {
  return runPnpm(['run', script], env);
}

function runPrismaDiff(env) {
  return runPnpm([
    'exec', 'prisma', 'migrate', 'diff',
    '--config', 'prisma.config.ts',
    '--from-schema', 'prisma/schema.prisma',
    '--to-config-datasource',
    '--exit-code',
  ], env);
}

function runPnpm(args, env) {
  const packageManagerScript = process.env.npm_execpath;
  const command = packageManagerScript ? process.execPath : 'corepack';
  const commandArgs = packageManagerScript ? [packageManagerScript, ...args] : ['pnpm', ...args];
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { cwd: new URL('..', import.meta.url), env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Fresh-database verification command failed${signal ? ` with signal ${signal}` : ` with exit code ${code ?? 'unknown'}`}.`));
    });
  });
}

function assertSafeDatabaseUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('FRESH_DATABASE_URL must be a valid mysql:// URL.');
  }
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  if (parsed.protocol !== 'mysql:' || !databaseName) {
    throw new Error('FRESH_DATABASE_URL must be a mysql:// URL with an explicit database name.');
  }
  if (['mysql', 'information_schema', 'performance_schema', 'sys'].includes(databaseName.toLowerCase())) {
    throw new Error('FRESH_DATABASE_URL must not target a MySQL system database.');
  }
}

function databaseTarget(value) {
  try {
    const parsed = new URL(value);
    return `${parsed.hostname.toLowerCase()}:${parsed.port || '3306'}/${decodeURIComponent(parsed.pathname.slice(1)).toLowerCase()}`;
  } catch {
    return value;
  }
}

function reportFailure(error) {
  if (failureReported) return;
  failureReported = true;
  const message = error instanceof Error ? error.message : 'Fresh-database verification failed.';
  console.error([freshDatabaseUrl]
    .reduce((sanitized, secret) => sanitized.split(secret).join('[FRESH_DATABASE_URL]'), message));
  process.exitCode = 1;
}
