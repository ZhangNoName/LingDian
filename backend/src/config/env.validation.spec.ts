import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateEnv } from './env.validation';

test('rejects missing JWT secrets outside test', () => {
  assert.throws(
    () => validateEnv({ NODE_ENV: 'production' }),
    /AUTH_JWT_ACCESS_SECRET/,
  );
});

test('rejects a missing or unrecognized runtime environment', () => {
  assert.throws(
    () => validateEnv({}),
    /NODE_ENV must be development, test, or production/,
  );
  assert.throws(
    () => validateEnv({ NODE_ENV: 'prod' }),
    /NODE_ENV must be development, test, or production/,
  );
  assert.throws(
    () => validateEnv({ NODE_ENV: 'Production' }),
    /NODE_ENV must be development, test, or production/,
  );
});

test('accepts a complete auth configuration', () => {
  assert.equal(
    validateEnv({
      NODE_ENV: 'test',
      DATABASE_URL: 'mysql://root:password@localhost:3306/lingdian',
      AUTH_JWT_ACCESS_SECRET: 'a'.repeat(32),
      AUTH_REFRESH_PEPPER: 'b'.repeat(32),
    }).NODE_ENV,
    'test',
  );
});

test('accepts a complete production configuration', () => {
  assert.equal(validateEnv(productionEnv()).NODE_ENV, 'production');
});

test('requires an explicit single-store runtime configuration in production', () => {
  assert.throws(
    () => validateEnv(productionEnv({ STORE_MODE: undefined })),
    /STORE_MODE is required in production/,
  );
  assert.throws(
    () => validateEnv(productionEnv({ PRIMARY_STORE_ID: undefined })),
    /PRIMARY_STORE_ID is required outside test/,
  );
  assert.throws(
    () => validateEnv(productionEnv({ STORE_MODE: 'multi' })),
    /multi-store runtime is not enabled/i,
  );
});

test('validates primary store identity and merchant bootstrap scope', () => {
  assert.throws(
    () => validateEnv(productionEnv({ PRIMARY_STORE_ID: ' store-1' })),
    /leading or trailing whitespace/,
  );
  assert.throws(
    () => validateEnv(productionEnv({ PRIMARY_STORE_ID: 'x'.repeat(192) })),
    /must not exceed 191/,
  );
  assert.throws(
    () => validateEnv(productionEnv({
      AUTH_BOOTSTRAP_MERCHANT_USERNAME: 'merchant',
      AUTH_BOOTSTRAP_MERCHANT_PASSWORD: 'merchant-password',
      AUTH_BOOTSTRAP_MERCHANT_PHONE: '13800000000',
      AUTH_BOOTSTRAP_MERCHANT_STORE_IDS: 'store-2',
    })),
    /must contain only PRIMARY_STORE_ID/,
  );
});

test('unit-test environments may omit store configuration', () => {
  assert.equal(validateEnv({ NODE_ENV: 'test' }).NODE_ENV, 'test');
});

test('rejects a short JWT access secret outside test', () => {
  assert.throws(
    () => validateEnv(productionEnv({ AUTH_JWT_ACCESS_SECRET: 'a'.repeat(31) })),
    /AUTH_JWT_ACCESS_SECRET must be at least 32 characters/,
  );
});

test('rejects a missing refresh pepper outside test', () => {
  assert.throws(
    () => validateEnv(productionEnv({ AUTH_REFRESH_PEPPER: undefined })),
    /AUTH_REFRESH_PEPPER is required outside test/,
  );
});

test('rejects a short refresh pepper outside test', () => {
  assert.throws(
    () => validateEnv(productionEnv({ AUTH_REFRESH_PEPPER: 'b'.repeat(31) })),
    /AUTH_REFRESH_PEPPER must be at least 32 characters/,
  );
});

test('rejects public placeholder and reused production secrets', () => {
  assert.throws(
    () => validateEnv(productionEnv({
      AUTH_JWT_ACCESS_SECRET: 'replace-with-at-least-32-random-characters',
    })),
    /must not use a public example or placeholder value/,
  );
  assert.throws(
    () => validateEnv(productionEnv({
      AUTH_REFRESH_PEPPER: 'a'.repeat(32),
    })),
    /must be different secrets/,
  );
});

test('requires a production database and explicit HTTPS CORS origins', () => {
  assert.throws(
    () => validateEnv(productionEnv({ DATABASE_URL: undefined })),
    /DATABASE_URL is required in production/,
  );
  assert.throws(
    () => validateEnv(productionEnv({ CORS_ALLOWED_ORIGINS: undefined })),
    /CORS_ALLOWED_ORIGINS is required in production/,
  );
  assert.throws(
    () => validateEnv(productionEnv({ CORS_ALLOWED_ORIGINS: 'http://app.example.com' })),
    /absolute HTTPS origins/,
  );
  assert.throws(
    () => validateEnv(productionEnv({ CORS_ALLOWED_ORIGINS: 'https://app.example.com/api' })),
    /without paths/,
  );
});

test('production database mode fails closed for local and external transports', () => {
  assert.throws(
    () => validateEnv(productionEnv({ DATABASE_MODE: undefined })),
    /DATABASE_MODE is required in production/,
  );
  assert.throws(
    () => validateEnv(productionEnv({ DATABASE_URL: 'mysql://root:password@localhost:3306/lingdian' })),
    /hostname must be db/,
  );
  assert.throws(
    () => validateEnv(productionEnv({
      DATABASE_MODE: 'external',
      DATABASE_URL: 'mysql://service:password@db.example.com:3306/lingdian',
    })),
    /sslaccept=strict/,
  );
  assert.equal(validateEnv(productionEnv({
    DATABASE_MODE: 'external',
    DATABASE_URL: 'mysql://service:password@db.example.com:3306/lingdian?sslaccept=strict&sslcert=external-mysql-ca.pem',
  })).DATABASE_MODE, 'external');
});

test('requires exactly one trusted reverse-proxy hop in production', () => {
  assert.throws(
    () => validateEnv(productionEnv({ TRUST_PROXY_HOPS: undefined })),
    /TRUST_PROXY_HOPS must be exactly 1/,
  );
  assert.throws(
    () => validateEnv(productionEnv({ TRUST_PROXY_HOPS: '2' })),
    /TRUST_PROXY_HOPS must be exactly 1/,
  );
  assert.throws(
    () => validateEnv({ NODE_ENV: 'test', TRUST_PROXY_HOPS: '-1' }),
    /non-negative integer/,
  );
});

test('requires the access token TTL to remain 900 seconds in production', () => {
  assert.throws(
    () => validateEnv(productionEnv({ AUTH_ACCESS_TOKEN_TTL_SECONDS: undefined })),
    /AUTH_ACCESS_TOKEN_TTL_SECONDS must be exactly 900/,
  );
  assert.throws(
    () => validateEnv(productionEnv({ AUTH_ACCESS_TOKEN_TTL_SECONDS: '901' })),
    /AUTH_ACCESS_TOKEN_TTL_SECONDS must be exactly 900/,
  );
});

test('requires the refresh token TTL to remain 30 days in production', () => {
  assert.throws(
    () => validateEnv(productionEnv({ AUTH_REFRESH_TOKEN_TTL_DAYS: undefined })),
    /AUTH_REFRESH_TOKEN_TTL_DAYS must be exactly 30/,
  );
  assert.throws(
    () => validateEnv(productionEnv({ AUTH_REFRESH_TOKEN_TTL_DAYS: '31' })),
    /AUTH_REFRESH_TOKEN_TTL_DAYS must be exactly 30/,
  );
});

test('rejects invalid auth TTL values', () => {
  assert.throws(
    () => validateEnv(productionEnv({ AUTH_ACCESS_TOKEN_TTL_SECONDS: 'invalid' })),
    /AUTH_ACCESS_TOKEN_TTL_SECONDS must be exactly 900/,
  );
});

test('requires secure cookies in production', () => {
  assert.throws(
    () => validateEnv(productionEnv({ AUTH_COOKIE_SECURE: 'false' })),
    /AUTH_COOKIE_SECURE must be true in production/,
  );
});

test('rejects incomplete WeChat OAuth configuration in production', () => {
  assert.throws(
    () => validateEnv(productionEnv({ WECHAT_APP_SECRET: '' })),
    /WECHAT_APP_SECRET is required in production/,
  );
});

test('rejects incomplete QQ OAuth configuration in production', () => {
  assert.throws(
    () => validateEnv(productionEnv({ QQ_APP_KEY: '' })),
    /QQ_APP_KEY is required in production/,
  );
});

test('rejects incomplete mini-program OAuth configuration in production', () => {
  assert.throws(
    () => validateEnv(productionEnv({ QQ_MINI_APP_SECRET: '' })),
    /QQ_MINI_APP_SECRET is required in production/,
  );
});

test('rejects console SMS and non-HTTPS OAuth redirects in production', () => {
  assert.throws(() => validateEnv(productionEnv({ SMS_PROVIDER: 'console' })), /SMS_PROVIDER/);
  assert.throws(() => validateEnv(productionEnv({ WECHAT_REDIRECT_URI: 'http://example.com/callback' })), /WECHAT_REDIRECT_URI must be an absolute HTTPS URL/);
  assert.throws(() => validateEnv(productionEnv({ QQ_REDIRECT_URI: '/callback' })), /QQ_REDIRECT_URI must be an absolute HTTPS URL/);
});

test('rejects a partially configured bootstrap account group', () => {
  assert.throws(
    () => validateEnv({ NODE_ENV: 'test', AUTH_BOOTSTRAP_SUPER_ADMIN_USERNAME: 'admin' }),
    /AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD.*AUTH_BOOTSTRAP_SUPER_ADMIN_PHONE/i,
  );
});

function productionEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: 'production',
    DATABASE_MODE: 'local',
    STORE_MODE: 'single',
    PRIMARY_STORE_ID: 'store-1',
    DATABASE_URL: 'mysql://root:password@db:3306/lingdian?allowPublicKeyRetrieval=true',
    AUTH_JWT_ACCESS_SECRET: 'a'.repeat(32),
    AUTH_REFRESH_PEPPER: 'b'.repeat(32),
    AUTH_ACCESS_TOKEN_TTL_SECONDS: '900',
    AUTH_REFRESH_TOKEN_TTL_DAYS: '30',
    AUTH_COOKIE_SECURE: 'true',
    TRUST_PROXY_HOPS: '1',
    CORS_ALLOWED_ORIGINS: 'https://app.example.com,https://merchant.example.com,https://admin.example.com',
    SMS_PROVIDER: 'webhook',
    SMS_WEBHOOK_URL: 'https://sms.example.com/send',
    SMS_WEBHOOK_TOKEN: 's'.repeat(32),
    WECHAT_APP_ID: 'wechat-app-id',
    WECHAT_APP_SECRET: 'wechat-app-secret',
    WECHAT_REDIRECT_URI: 'https://example.com/auth/wechat/callback',
    WECHAT_MINI_APP_ID: 'wechat-mini-app-id',
    WECHAT_MINI_APP_SECRET: 'wechat-mini-app-secret',
    QQ_APP_ID: 'qq-app-id',
    QQ_APP_KEY: 'qq-app-key',
    QQ_REDIRECT_URI: 'https://example.com/auth/qq/callback',
    QQ_MINI_APP_ID: 'qq-mini-app-id',
    QQ_MINI_APP_SECRET: 'qq-mini-app-secret',
    ...overrides,
  };
}
