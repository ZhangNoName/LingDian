import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { createMariaDbConnectionConfig, PrismaClient } from '@lingdian/db';
import { bootstrapAccounts } from './auth-bootstrap.lib.mjs';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) throw new Error('DATABASE_URL is required.');

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(createMariaDbConnectionConfig(databaseUrl, {
    requireTls: process.env.DATABASE_MODE === 'external' ||
      (process.env.NODE_ENV === 'production' && process.env.DATABASE_MODE !== 'local'),
  })),
});

bootstrapAccounts({ prisma, env: process.env })
  .then((result) => {
    console.log(`Bootstrap accounts ready: super administrator ${bootstrapAction(result.admin)}, merchant ${bootstrapAction(result.merchant)}.`);
  })
  .catch((error) => {
    console.error(safeErrorMessage(error));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

function bootstrapAction(result) {
  if (result.created) return 'created';
  return result.changed ? 'synchronized' : 'unchanged';
}

function safeErrorMessage(error) {
  const message = error instanceof Error ? error.message : 'Bootstrap account initialization failed.';
  return [databaseUrl]
    .reduce((sanitized, secret) => sanitized.split(secret).join('[DATABASE_URL]'), message);
}
