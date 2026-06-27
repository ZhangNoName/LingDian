import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

for (const envFile of [
  resolve(process.cwd(), '../../.env'),
  resolve(process.cwd(), '../../backend/.env'),
  resolve(process.cwd(), '.env'),
]) {
  if (existsSync(envFile)) {
    config({ path: envFile });
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
