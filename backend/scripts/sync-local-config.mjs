import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const windowsPath = (value) => value.replace(/\//g, path.sep);
const argConfigIndex = process.argv.findIndex((arg) => arg === '--config');
const argConfigPath = argConfigIndex >= 0 ? process.argv[argConfigIndex + 1] : undefined;
const configPath =
  argConfigPath ||
  process.env.LOCAL_CONFIG_PATH ||
  path.resolve(backendRoot, 'config.yaml');

if (!fs.existsSync(configPath)) {
  throw new Error(`Config file not found: ${configPath}`);
}

const rawConfig = fs.readFileSync(configPath, 'utf8');
const parsed = yaml.load(rawConfig);

if (!parsed || typeof parsed !== 'object' || !('mysql' in parsed)) {
  throw new Error('The config file does not contain a mysql section.');
}

const mysql = parsed.mysql;

if (!mysql.ip || !mysql.port || !mysql.db || !mysql.user || !mysql.password) {
  throw new Error('MySQL config is incomplete. Required: ip, port, db, user, password.');
}

const user = encodeURIComponent(String(mysql.user));
const password = encodeURIComponent(String(mysql.password));
const host = String(mysql.ip);
const port = Number(mysql.port);
const database = String(mysql.db);
const databaseUrl = `mysql://${user}:${password}@${host}:${port}/${database}`;

const envContent = [
  `PORT=${process.env.PORT ?? '3000'}`,
  `API_PREFIX=${process.env.API_PREFIX ?? 'api'}`,
  `NODE_ENV=${process.env.NODE_ENV ?? 'development'}`,
  `DATABASE_URL=${databaseUrl}`,
  `LOCAL_CONFIG_PATH=${windowsPath(configPath)}`,
  '',
].join('\n');

fs.writeFileSync(path.join(backendRoot, '.env'), envContent, 'utf8');
console.log(`Generated backend .env from ${configPath}`);
