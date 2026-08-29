import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { parse as parseEnv } from 'dotenv';

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
const envPath = path.join(backendRoot, '.env');
const existingEnv = fs.existsSync(envPath)
  ? parseEnv(fs.readFileSync(envPath, 'utf8'))
  : {};
const value = (name, fallback) => process.env[name] ?? existingEnv[name] ?? fallback;
const nextEnv = {
  ...existingEnv,
  PORT: value('PORT', '9000'),
  API_PREFIX: value('API_PREFIX', 'api'),
  NODE_ENV: value('NODE_ENV', 'development'),
  DATABASE_URL: databaseUrl,
  LOCAL_CONFIG_PATH: windowsPath(configPath),
  STORE_MODE: value('STORE_MODE', 'single'),
  PRIMARY_STORE_ID: value('PRIMARY_STORE_ID', 'local-demo-store'),
  ALLOW_DEMO_SEED: value('ALLOW_DEMO_SEED', 'false'),
  AUTH_JWT_ACCESS_SECRET: value('AUTH_JWT_ACCESS_SECRET', 'local-development-jwt-secret-change-me-1234567890'),
  AUTH_REFRESH_PEPPER: value('AUTH_REFRESH_PEPPER', 'local-development-refresh-pepper-change-me-123456'),
  AUTH_ACCESS_TOKEN_TTL_SECONDS: value('AUTH_ACCESS_TOKEN_TTL_SECONDS', '900'),
  AUTH_REFRESH_TOKEN_TTL_DAYS: value('AUTH_REFRESH_TOKEN_TTL_DAYS', '30'),
  AUTH_COOKIE_SECURE: value('AUTH_COOKIE_SECURE', 'false'),
  SMS_PROVIDER: value('SMS_PROVIDER', 'console'),
};
const preferredOrder = [
  'PORT', 'API_PREFIX', 'NODE_ENV', 'DATABASE_URL', 'LOCAL_CONFIG_PATH',
  'STORE_MODE', 'PRIMARY_STORE_ID', 'ALLOW_DEMO_SEED',
  'AUTH_JWT_ACCESS_SECRET', 'AUTH_REFRESH_PEPPER',
  'AUTH_ACCESS_TOKEN_TTL_SECONDS', 'AUTH_REFRESH_TOKEN_TTL_DAYS',
  'AUTH_COOKIE_SECURE', 'SMS_PROVIDER',
];
const remainingKeys = Object.keys(nextEnv)
  .filter((name) => !preferredOrder.includes(name))
  .sort();
const envContent = [...preferredOrder, ...remainingKeys]
  .map((name) => `${name}=${encodeEnvValue(nextEnv[name])}`)
  .concat('')
  .join('\n');

fs.writeFileSync(envPath, envContent, 'utf8');
console.log(`Generated backend .env from ${configPath}`);

function encodeEnvValue(input) {
  const text = String(input);
  return /^[A-Za-z0-9_./:@+-]*$/.test(text) ? text : JSON.stringify(text);
}
