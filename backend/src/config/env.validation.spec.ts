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

test('requires the access token TTL to remain 900 seconds in production', () => {
  assert.throws(
    () => validateEnv(productionEnv({ AUTH_ACCESS_TOKEN_TTL_SECONDS: '901' })),
    /AUTH_ACCESS_TOKEN_TTL_SECONDS must be exactly 900/,
  );
});

test('requires the refresh token TTL to remain 30 days in production', () => {
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
    STORE_MODE: 'single',
    PRIMARY_STORE_ID: 'store-1',
    DATABASE_URL: 'mysql://root:password@localhost:3306/lingdian',
    AUTH_JWT_ACCESS_SECRET: 'a'.repeat(32),
    AUTH_REFRESH_PEPPER: 'b'.repeat(32),
    AUTH_ACCESS_TOKEN_TTL_SECONDS: '900',
    AUTH_REFRESH_TOKEN_TTL_DAYS: '30',
    AUTH_COOKIE_SECURE: 'true',
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
