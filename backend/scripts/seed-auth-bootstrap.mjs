import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@lingdian/db';
import { bootstrapAccounts } from './auth-bootstrap.lib.mjs';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) throw new Error('DATABASE_URL is required.');

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseUrl) });

bootstrapAccounts({ prisma, env: process.env })
  .then((result) => {
    console.log(`Bootstrap accounts ready: super administrator ${result.admin.created ? 'created' : 'updated'}, merchant ${result.merchant.created ? 'created' : 'updated'}.`);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Bootstrap account initialization failed.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
